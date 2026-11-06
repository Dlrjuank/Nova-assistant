import { MINUTOS_TOPE_INDICE } from '@/lib/config/nova';
import { consultar } from '@/lib/db/conexion';
import { llm } from '@/lib/llm/gemini';
import { SIN_RECOMENDACION, SYSTEM_PROMPT_PRODUCTIVIDAD } from '@/lib/llm/prompts';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { esFechaISOValida, hoyBogota } from '@/lib/reglas/fechas';
import { calcularIndice } from '@/lib/reglas/productividad';
import type { ResultadoProductividad } from './tipos';

/**
 * CU-05 (RN-03, RN-18). Cuenta las tareas cuya fecha límite es la fecha evaluada; sin tareas no calcula.
 * Si Gemini falla, el índice se entrega igual con un texto fijo: los números no dependen del modelo.
 */
export async function calcularProductividad(
  usuarioId: string,
  fecha?: string,
): Promise<ResultadoProductividad | { sinTareas: true }> {
  const dia = fecha ?? hoyBogota();
  if (!esFechaISOValida(dia)) throw new ErrorDeNegocio('FECHA_INVALIDA');

  // BIGINT en la suma: varios minutos grandes podrían desbordar INTEGER. El parser lo devuelve como number.
  const [conteo] = await consultar<{ totales: number; completadas: number; minutos: number }>(
    `SELECT COUNT(*)::bigint AS totales,
       COUNT(*) FILTER (WHERE estado = 'Completada')::bigint AS completadas,
       COALESCE(SUM(minutos_invertidos) FILTER (WHERE estado = 'Completada'), 0)::bigint AS minutos
     FROM tareas_personales
     WHERE fecha_limite = $1 AND usuario_id = $2`,
    [dia, usuarioId],
  );
  const { totales = 0, completadas = 0, minutos = 0 } = conteo ?? {};
  if (totales === 0) return { sinTareas: true }; // RN-18: nunca se divide por cero

  const { puntos, nivel } = calcularIndice({ completadas, totales, minutos });
  const base = { fecha: dia, totales, completadas, minutos, puntos, nivel };
  try {
    const recomendacion = await llm.responder({
      sistema: SYSTEM_PROMPT_PRODUCTIVIDAD,
      contexto: [
        `Tareas del día: ${totales}`,
        `Tareas completadas: ${completadas}`,
        `Minutos dedicados a las completadas: ${minutos} (cuentan hasta ${MINUTOS_TOPE_INDICE})`,
        `Puntos: ${puntos.toFixed(1)} de 100`,
        `Nivel: ${nivel}`,
      ].join('\n'),
      pregunta: 'Escribe la recomendación.',
    });
    return { ...base, recomendacion, recomendacionDisponible: true };
  } catch (error) {
    if (!(error instanceof ErrorDeNegocio)) throw error;
    return { ...base, recomendacion: SIN_RECOMENDACION, recomendacionDisponible: false };
  }
}
