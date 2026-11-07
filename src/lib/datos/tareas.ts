import { CATEGORIA_POR_DEFECTO, LIMITE_LISTADO, TAREAS_CONTEXTO_MAX } from '@/lib/config/nova';
import { consultar } from '@/lib/db/conexion';
import { hoyBogota } from '@/lib/reglas/fechas';
import { formatearFecha, formatearPrioridad } from '@/lib/formato';
import type { TareaContexto } from '@/lib/llm/prompts';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { validarTarea } from '@/lib/reglas/tarea';
import type { DatosTarea, EstadoTarea, Tarea } from './tipos';

const COLUMNAS = `id, titulo, categoria, prioridad, estado,
  minutos_invertidos AS "minutosInvertidos",
  fecha_limite AS "fechaLimite",
  fecha_creacion AS "fechaCreacion",
  fecha_cierre AS "fechaCierre"`;

// RB-01 (ampliación): toda función recibe el id del usuario de la sesión y solo ve sus tareas.
// Una tarea de otro usuario se comporta como inexistente.

/** RN-04, RN-06, RN-07 y RN-08. */
export async function crearTarea(usuarioId: string, d: DatosTarea): Promise<Tarea> {
  const { titulo, prioridad } = validarTarea(d);
  const categoria = d.categoria?.trim() || CATEGORIA_POR_DEFECTO;
  const [tarea] = await consultar<Tarea>(
    `INSERT INTO tareas_personales (titulo, categoria, prioridad, estado, fecha_limite, fecha_creacion, usuario_id)
     VALUES ($1, $2, $3, 'Pendiente', $4, $5, $6)
     RETURNING ${COLUMNAS}`,
    [titulo, categoria, prioridad, d.fechaLimite, hoyBogota(), usuarioId],
  );
  return tarea as Tarea;
}

export async function listarTareas(
  usuarioId: string,
  f: { estado?: EstadoTarea | undefined; fecha?: string | undefined; limite?: number | undefined } = {},
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
  valores.push(f.limite ?? LIMITE_LISTADO);
  return consultar<Tarea>(
    `SELECT ${COLUMNAS} FROM tareas_personales WHERE ${condiciones.join(' AND ')}
     ORDER BY fecha_limite, created_at
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
    texto: `${t.titulo} (categoría: ${t.categoria}; prioridad: ${formatearPrioridad(t.prioridad)}; fecha límite: ${formatearFecha(t.fechaLimite)}, ${String(t.fechaLimite).slice(0, 10)})`,
  }));
}

/** RN-16: la condición va en el UPDATE para que dos envíos simultáneos no sobrescriban los minutos. */
export async function completarTarea(usuarioId: string, id: string, minutos: number): Promise<Tarea> {
  const [tarea] = await consultar<Tarea>(
    `UPDATE tareas_personales
     SET estado = 'Completada', minutos_invertidos = $2, fecha_cierre = $3
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
