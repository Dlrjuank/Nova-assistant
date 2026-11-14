import { LIMITE_LISTADO, TAREAS_CONTEXTO_MAX } from '@/lib/config/nova';
import type { PoolClient } from 'pg';
import { conTransaccion, consultar } from '@/lib/db/conexion';
import {
  estadoInicial,
  HORA_RECORDATORIO_POR_DEFECTO,
  momentoRecordatorio,
  validarRecordatorio,
  type EstadoRecordatorio,
  type Recordatorio,
} from '@/lib/reglas/recordatorios';
import { hoyBogota } from '@/lib/reglas/fechas';
import { formatearFecha, formatearPrioridad } from '@/lib/formato';
import { formatearHorario, validarHorario } from '@/lib/reglas/horario';
import type { TareaContexto } from '@/lib/llm/prompts';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { validarTarea } from '@/lib/reglas/tarea';
import { resolverCategoria } from './categorias';
import type { DatosTarea, EstadoTarea, Tarea } from './tipos';

const COLUMNAS = `id, titulo, categoria, prioridad, estado,
  minutos_invertidos AS "minutosInvertidos",
  fecha_limite AS "fechaLimite",
  fecha_creacion AS "fechaCreacion",
  fecha_cierre AS "fechaCierre",
  to_char(hora_inicio, 'HH24:MI') AS "horaInicio",
  to_char(hora_fin, 'HH24:MI') AS "horaFin",
  recordatorio,
  recordatorio_estado AS "recordatorioEstado"`;

// RB-01 (ampliación): toda función recibe el id del usuario de la sesión y solo ve sus tareas.
// Una tarea de otro usuario se comporta como inexistente.

interface RecordatorioCalculado {
  recordatorio: Recordatorio | null;
  en: Date | null;
  estado: EstadoRecordatorio | null;
}

/** La hora fija de Configuración (8:00 sin fila), leída dentro de la transacción. */
async function horaFijaDe(tx: PoolClient, usuarioId: string): Promise<string> {
  const { rows } = await tx.query<{ hora: string }>(
    `SELECT to_char(hora_recordatorio, 'HH24:MI') AS hora FROM preferencias_usuario WHERE usuario_id = $1`,
    [usuarioId],
  );
  return rows[0]?.hora ?? HORA_RECORDATORIO_POR_DEFECTO;
}

/** E11c (7.10, RB-43): el momento y el estado del recordatorio; si ya pasó, queda omitido. */
async function calcularRecordatorio(
  tx: PoolClient,
  usuarioId: string,
  d: { recordatorio: Recordatorio | null; fechaLimite: string; horaInicio: string | null },
  ahora: Date,
): Promise<RecordatorioCalculado> {
  if (!d.recordatorio) return { recordatorio: null, en: null, estado: null };
  const en = momentoRecordatorio({ ...d, recordatorio: d.recordatorio, horaFija: d.horaInicio ? undefined : await horaFijaDe(tx, usuarioId) });
  return { recordatorio: d.recordatorio, en, estado: estadoInicial(en, ahora) };
}

/** RN-04, RN-06, RN-07 y RN-08. RB-33: la categoría se resuelve (o se crea) en la misma transacción. */
export async function crearTarea(usuarioId: string, d: DatosTarea): Promise<Tarea> {
  return (await crearTareaConResultado(usuarioId, d)).tarea;
}

/**
 * Crear, y E11e (7.14): con `idCliente` (una tarea creada sin conexión), si ya existe una tarea del usuario con
 * ese identificador se devuelve esa, sin crear otra ni volver a resolver la categoría ni el recordatorio. Si dos
 * envíos llegan a la vez, el índice único (M23) deja insertar solo a uno; el otro encuentra la tarea guardada.
 */
export async function crearTareaConResultado(usuarioId: string, d: DatosTarea): Promise<{ tarea: Tarea; yaExistia: boolean }> {
  const { titulo, prioridad } = validarTarea(d);
  const { horaInicio, horaFin } = validarHorario(d.horaInicio, d.horaFin); // RB-34
  const recordatorio = validarRecordatorio(d.recordatorio, horaInicio); // RB-43
  const idCliente = d.idCliente ?? null;
  const existente = async (tx: PoolClient) =>
    (await tx.query<Tarea>(`SELECT ${COLUMNAS} FROM tareas_personales WHERE usuario_id = $1 AND id_cliente = $2`, [usuarioId, idCliente])).rows[0];
  return conTransaccion(async (tx) => {
    if (idCliente) {
      const ya = await existente(tx);
      if (ya) return { tarea: ya, yaExistia: true };
    }
    const categoria = await resolverCategoria(tx, usuarioId, d.categoria);
    const r = await calcularRecordatorio(tx, usuarioId, { recordatorio, fechaLimite: d.fechaLimite, horaInicio }, new Date());
    const { rows } = await tx.query<Tarea>(
      `INSERT INTO tareas_personales
         (titulo, categoria, prioridad, estado, fecha_limite, fecha_creacion, usuario_id, hora_inicio, hora_fin,
          recordatorio, recordatorio_en, recordatorio_estado, id_cliente)
       VALUES ($1, $2, $3, 'Pendiente', $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (usuario_id, id_cliente) WHERE id_cliente IS NOT NULL DO NOTHING
       RETURNING ${COLUMNAS}`,
      [titulo, categoria, prioridad, d.fechaLimite, hoyBogota(), usuarioId, horaInicio, horaFin, r.recordatorio, r.en, r.estado, idCliente],
    );
    if (rows[0]) return { tarea: rows[0], yaExistia: false };
    // Otro envío con el mismo idCliente la guardó mientras tanto.
    const ya = await existente(tx);
    if (!ya) throw new ErrorDeNegocio('ERROR_INTERNO');
    return { tarea: ya, yaExistia: true };
  });
}

/**
 * 7.10: al cambiar la hora fija, los recordatorios de las tareas pendientes sin horario se recalculan (los ya
 * enviados no). El cálculo es el mismo de momentoRecordatorio, en SQL: la fecha (o la del día anterior) a esa hora
 * de Bogotá.
 */
export async function recalcularRecordatoriosSinHorario(tx: PoolClient, usuarioId: string, hora: string): Promise<void> {
  await tx.query(
    `WITH nuevo AS (
       SELECT id, ((fecha_limite - CASE WHEN recordatorio = '1_dia' THEN 1 ELSE 0 END) + $2::time) AT TIME ZONE 'America/Bogota' AS en
       FROM tareas_personales
       WHERE usuario_id = $1 AND hora_inicio IS NULL AND recordatorio IS NOT NULL
         AND recordatorio_estado <> 'enviado' AND estado <> 'Completada'
     )
     UPDATE tareas_personales t
     SET recordatorio_en = nuevo.en, recordatorio_estado = CASE WHEN nuevo.en <= now() THEN 'omitido' ELSE 'pendiente' END
     FROM nuevo WHERE t.id = nuevo.id`,
    [usuarioId, hora],
  );
}

/** E09: una tarea del usuario, o null si no existe o es de otro. */
export async function obtenerTarea(usuarioId: string, id: string): Promise<Tarea | null> {
  const [tarea] = await consultar<Tarea>(`SELECT ${COLUMNAS} FROM tareas_personales WHERE id = $1 AND usuario_id = $2`, [id, usuarioId]);
  return tarea ?? null;
}

/**
 * E09 (RB-29): edita una tarea pendiente con las mismas reglas que crear; no toca estado, minutos ni cierre.
 * La fila se bloquea antes de resolver la categoría: una tarea completada o ajena no deja una categoría nueva.
 */
export async function editarTarea(usuarioId: string, id: string, d: DatosTarea): Promise<Tarea> {
  const { titulo, prioridad } = validarTarea(d);
  const { horaInicio, horaFin } = validarHorario(d.horaInicio, d.horaFin); // RB-34
  const recordatorio = validarRecordatorio(d.recordatorio, horaInicio); // RB-43
  return conTransaccion(async (tx) => {
    const { rows: actual } = await tx.query<{ estado: EstadoTarea; recordatorioEn: Date | null; recordatorioEstado: EstadoRecordatorio | null }>(
      `SELECT estado, recordatorio_en AS "recordatorioEn", recordatorio_estado AS "recordatorioEstado"
       FROM tareas_personales WHERE id = $1 AND usuario_id = $2 FOR UPDATE`,
      [id, usuarioId],
    );
    const previo = actual[0];
    if (!previo) throw new ErrorDeNegocio('TAREA_NO_ENCONTRADA');
    if (previo.estado === 'Completada') throw new ErrorDeNegocio('TAREA_YA_COMPLETADA');
    const categoria = await resolverCategoria(tx, usuarioId, d.categoria);
    const r = await calcularRecordatorio(tx, usuarioId, { recordatorio, fechaLimite: d.fechaLimite, horaInicio }, new Date());
    // 7.10: se recalcula al editar; si el momento no cambió y ya se envió, no vuelve a avisar.
    const mismoMomento = r.en !== null && previo.recordatorioEn !== null && r.en.getTime() === new Date(previo.recordatorioEn).getTime();
    const estado = mismoMomento && previo.recordatorioEstado === 'enviado' ? 'enviado' : r.estado;
    const { rows } = await tx.query<Tarea>(
      `UPDATE tareas_personales
       SET titulo = $3, categoria = $4, prioridad = $5, fecha_limite = $6, hora_inicio = $7, hora_fin = $8,
           recordatorio = $9, recordatorio_en = $10, recordatorio_estado = $11
       WHERE id = $1 AND usuario_id = $2
       RETURNING ${COLUMNAS}`,
      [id, usuarioId, titulo, categoria, prioridad, d.fechaLimite, horaInicio, horaFin, r.recordatorio, r.en, estado],
    );
    return rows[0] as Tarea;
  });
}

export async function listarTareas(
  usuarioId: string,
  f: {
    estado?: EstadoTarea | undefined;
    fecha?: string | undefined;
    /** E05b: filtro de la fila de categorías, sin distinguir mayúsculas. */
    categoria?: string | undefined;
    /** E06: rango de fecha límite (incluidos los extremos), para la semana de Inicio. */
    desde?: string | undefined;
    hasta?: string | undefined;
    /** E08: "Importantes" y "Vencidas" piden solo lo que no está completado; "Importantes", prioridad Alta. */
    soloPendientes?: boolean | undefined;
    prioridad?: number | undefined;
    limite?: number | undefined;
  } = {},
): Promise<Tarea[]> {
  const valores: unknown[] = [usuarioId];
  const condiciones: string[] = ['usuario_id = $1'];
  if (f.estado) {
    valores.push(f.estado);
    condiciones.push(`estado = $${valores.length}`);
  }
  if (f.fecha) {
    valores.push(f.fecha);
    condiciones.push(`fecha_limite = $${valores.length}`);
  }
  if (f.desde) {
    valores.push(f.desde);
    condiciones.push(`fecha_limite >= $${valores.length}`);
  }
  if (f.hasta) {
    valores.push(f.hasta);
    condiciones.push(`fecha_limite <= $${valores.length}`);
  }
  if (f.soloPendientes) condiciones.push(`estado <> 'Completada'`);
  if (f.prioridad !== undefined) {
    valores.push(f.prioridad);
    condiciones.push(`prioridad = $${valores.length}`);
  }
  if (f.categoria?.trim()) {
    valores.push(f.categoria.trim());
    condiciones.push(`lower(btrim(categoria)) = lower($${valores.length})`);
  }
  valores.push(f.limite ?? LIMITE_LISTADO);
  return consultar<Tarea>(
    `SELECT ${COLUMNAS} FROM tareas_personales WHERE ${condiciones.join(' AND ')}
     ORDER BY fecha_limite, hora_inicio NULLS LAST, created_at
     LIMIT $${valores.length}`,
    valores,
  );
}

/**
 * RN-12: las tareas pendientes como texto legible para el contexto del LLM.
 * RB-30: como máximo las 50 de fecha límite más próxima (las vencidas van primero), para acotar los tokens.
 */
export async function tareasPendientesComoTexto(usuarioId: string): Promise<TareaContexto[]> {
  const tareas = await listarTareas(usuarioId, { estado: 'Pendiente', limite: TAREAS_CONTEXTO_MAX });
  return tareas.map((t) => ({
    id: t.id,
    // RB-31: la fecha también como AAAA-MM-DD, para que el modelo la compare con la línea HOY sin ambigüedad.
    // RB-34: con su horario, para preguntas como "¿qué tengo a las 3?".
    texto: `${t.titulo} (categoría: ${t.categoria}; prioridad: ${formatearPrioridad(t.prioridad)}; fecha límite: ${formatearFecha(t.fechaLimite)}, ${String(t.fechaLimite).slice(0, 10)}${t.horaInicio ? `; horario: ${formatearHorario(t)}` : ''})`,
  }));
}

/** RN-16: la condición va en el UPDATE para que dos envíos simultáneos no sobrescriban los minutos. */
export async function completarTarea(usuarioId: string, id: string, minutos: number): Promise<Tarea> {
  const [tarea] = await consultar<Tarea>(
    // E11c (7.10): al completarla, su recordatorio pendiente se cancela.
    `UPDATE tareas_personales
     SET estado = 'Completada', minutos_invertidos = $2, fecha_cierre = $3,
         recordatorio_estado = CASE WHEN recordatorio_estado = 'pendiente' THEN 'omitido' ELSE recordatorio_estado END
     WHERE id = $1 AND usuario_id = $4 AND estado <> 'Completada'
     RETURNING ${COLUMNAS}`,
    [id, minutos, hoyBogota(), usuarioId],
  );
  if (tarea) return tarea;

  const existe = await consultar<{ id: string }>('SELECT id FROM tareas_personales WHERE id = $1 AND usuario_id = $2', [
    id,
    usuarioId,
  ]);
  throw new ErrorDeNegocio(existe.length > 0 ? 'TAREA_YA_COMPLETADA' : 'TAREA_NO_ENCONTRADA');
}

/** RN-19: el borrado es definitivo; la interfaz pide confirmación antes de llamarlo. */
export async function eliminarTarea(usuarioId: string, id: string): Promise<void> {
  const borradas = await consultar<{ id: string }>(
    'DELETE FROM tareas_personales WHERE id = $1 AND usuario_id = $2 RETURNING id',
    [id, usuarioId],
  );
  if (borradas.length === 0) throw new ErrorDeNegocio('TAREA_NO_ENCONTRADA');
}

/** RB-30: ¿el usuario tiene al menos una tarea pendiente? (decide el aviso del Asistente). */
export async function hayTareasPendientes(usuarioId: string): Promise<boolean> {
  const [fila] = await consultar<{ existe: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM tareas_personales WHERE usuario_id = $1 AND estado = 'Pendiente') AS existe",
    [usuarioId],
  );
  return fila?.existe ?? false;
}
