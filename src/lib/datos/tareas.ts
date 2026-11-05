import { CATEGORIA_POR_DEFECTO, LIMITE_LISTADO } from '@/lib/config/nova';
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

/** RN-04, RN-06, RN-07 y RN-08. */
export async function crearTarea(d: DatosTarea): Promise<Tarea> {
  const { titulo, prioridad } = validarTarea(d);
  const categoria = d.categoria?.trim() || CATEGORIA_POR_DEFECTO;
  const [tarea] = await consultar<Tarea>(
    `INSERT INTO tareas_personales (titulo, categoria, prioridad, estado, fecha_limite, fecha_creacion)
     VALUES ($1, $2, $3, 'Pendiente', $4, $5)
     RETURNING ${COLUMNAS}`,
    [titulo, categoria, prioridad, d.fechaLimite, hoyBogota()],
  );
  return tarea as Tarea;
}

export async function listarTareas(f: { estado?: EstadoTarea | undefined; fecha?: string | undefined } = {}): Promise<Tarea[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];
  if (f.estado) {
    valores.push(f.estado);
    condiciones.push(`estado = $${valores.length}`);
  }
  if (f.fecha) {
    valores.push(f.fecha);
    condiciones.push(`fecha_limite = $${valores.length}`);
  }
  valores.push(LIMITE_LISTADO);
  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  return consultar<Tarea>(
    `SELECT ${COLUMNAS} FROM tareas_personales ${donde}
     ORDER BY fecha_limite, created_at
     LIMIT $${valores.length}`,
    valores,
  );
}

/** RN-12: las tareas pendientes como texto legible para el contexto del LLM. */
export async function tareasPendientesComoTexto(): Promise<TareaContexto[]> {
  const tareas = await listarTareas({ estado: 'Pendiente' });
  return tareas.map((t) => ({
    id: t.id,
    texto: `${t.titulo} (categoría: ${t.categoria}; prioridad: ${formatearPrioridad(t.prioridad)}; fecha límite: ${formatearFecha(t.fechaLimite)})`,
  }));
}

/** RN-16: la condición va en el UPDATE para que dos envíos simultáneos no sobrescriban los minutos. */
export async function completarTarea(id: string, minutos: number): Promise<Tarea> {
  const [tarea] = await consultar<Tarea>(
    `UPDATE tareas_personales
     SET estado = 'Completada', minutos_invertidos = $2, fecha_cierre = $3
     WHERE id = $1 AND estado <> 'Completada'
     RETURNING ${COLUMNAS}`,
    [id, minutos, hoyBogota()],
  );
  if (tarea) return tarea;

  const existe = await consultar<{ id: string }>('SELECT id FROM tareas_personales WHERE id = $1', [id]);
  throw new ErrorDeNegocio(existe.length > 0 ? 'TAREA_YA_COMPLETADA' : 'TAREA_NO_ENCONTRADA');
}

/** RN-19: el borrado es definitivo; la interfaz pide confirmación antes de llamarlo. */
export async function eliminarTarea(id: string): Promise<void> {
  const borradas = await consultar<{ id: string }>('DELETE FROM tareas_personales WHERE id = $1 RETURNING id', [id]);
  if (borradas.length === 0) throw new ErrorDeNegocio('TAREA_NO_ENCONTRADA');
}
