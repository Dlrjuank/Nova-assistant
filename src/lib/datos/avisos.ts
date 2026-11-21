import { consultar } from '@/lib/db/conexion';
import type { DatosAvisos } from '@/lib/reglas/avisos';
import { hoyBogota } from '@/lib/reglas/fechas';

/**
 * E20b (commit 1): lo que pide la navegación al abrir Nova y al cambiar de pantalla: el nombre del perfil, cuántas
 * tareas están vencidas y el próximo corte. Tres consultas pequeñas en paralelo, solo del usuario (RB-01).
 */
export async function avisosNavegacion(usuarioId: string, hoy: string = hoyBogota()): Promise<DatosAvisos> {
  const [usuario, vencidas, cortes] = await Promise.all([
    consultar<{ full_name: string | null }>('SELECT full_name FROM public.users WHERE id = $1', [usuarioId]),
    consultar<{ n: number }>(
      `SELECT COUNT(*)::bigint AS n FROM tareas_personales
       WHERE usuario_id = $1 AND estado <> 'Completada' AND fecha_limite < $2`,
      [usuarioId, hoy],
    ),
    consultar<{ materia_id: string; materia: string; corte: string; fecha: string }>(
      `SELECT m.id AS materia_id, m.nombre AS materia, c.nombre AS corte, to_char(c.fecha, 'YYYY-MM-DD') AS fecha
       FROM cortes c JOIN materias m ON m.id = c.materia_id AND m.usuario_id = c.usuario_id
       WHERE c.usuario_id = $1 AND c.fecha >= $2
       ORDER BY c.fecha, lower(m.nombre), c.orden
       LIMIT 1`,
      [usuarioId, hoy],
    ),
  ]);
  const corte = cortes[0];
  return {
    nombre: usuario[0]?.full_name ?? '',
    vencidas: Number(vencidas[0]?.n ?? 0),
    proximoCorte: corte ? { materiaId: corte.materia_id, materia: corte.materia, corte: corte.corte, fecha: corte.fecha } : null,
  };
}
