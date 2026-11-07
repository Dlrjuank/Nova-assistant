import { consultar } from '@/lib/db/conexion';
import { esFechaISOValida, hoyBogota, semanaDe } from '@/lib/reglas/fechas';
import { diasDeSemana, progresoSemanal, tareasPorDia, type Progreso } from '@/lib/reglas/semana';
import { listarTareas } from './tareas';
import type { Tarea } from './tipos';

export interface Semana {
  hoy: string;
  lunes: string;
  domingo: string;
  dias: string[];
  porDia: Record<string, Tarea[]>;
  progreso: Progreso;
  /** Pendientes con fecha límite hoy (siempre de hoy, aunque se muestre otra semana). */
  hoyPendientes: Tarea[];
  vencidas: number;
}

/**
 * E06 (PLAN_AMPLIACION 5.1): lo que necesita Inicio. `fecha` es cualquier día de la semana a mostrar
 * (sin fecha o inválida, la semana actual en Bogotá). Solo las tareas del usuario (RB-01).
 */
export async function semanaDeTareas(usuarioId: string, fecha?: string): Promise<Semana> {
  const hoy = hoyBogota();
  const base = fecha && esFechaISOValida(fecha) ? fecha : hoy;
  const { lunes, domingo } = semanaDe(base);
  const dias = diasDeSemana(base);
  const [deSemana, deHoy, vencidas] = await Promise.all([
    listarTareas(usuarioId, { desde: lunes, hasta: domingo }),
    listarTareas(usuarioId, { fecha: hoy, estado: 'Pendiente' }),
    consultar<{ n: number }>(
      `SELECT COUNT(*)::bigint AS n FROM tareas_personales
       WHERE usuario_id = $1 AND estado <> 'Completada' AND fecha_limite < $2`,
      [usuarioId, hoy],
    ),
  ]);
  return {
    hoy,
    lunes,
    domingo,
    dias,
    porDia: tareasPorDia(deSemana, dias),
    progreso: progresoSemanal(deSemana),
    hoyPendientes: deHoy,
    vencidas: Number(vencidas[0]?.n ?? 0),
  };
}
