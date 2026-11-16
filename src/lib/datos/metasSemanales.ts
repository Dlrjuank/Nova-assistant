import { consultar } from '@/lib/db/conexion';
import { validarNombreCategoria } from '@/lib/reglas/categorias';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import {
  progresoMeta,
  semanaActual,
  validarObjetivoMinutos,
  validarObjetivoTareas,
  type MetaSemanal,
  type ProgresoMeta,
  type TareaCerrada,
  type TipoMeta,
} from '@/lib/reglas/metasSemanales';

/** E15 (5.6, 6.6, 7.8): una meta con su progreso de la semana actual (calculado, nunca guardado). */
export interface MetaConProgreso extends MetaSemanal, ProgresoMeta {}

export interface MetasDeLaSemana {
  lunes: string;
  domingo: string;
  metas: MetaConProgreso[];
}

/** RB-01: solo las del usuario. Las globales primero; luego por categoría y tipo. */
export async function listarMetasSemanales(usuarioId: string, reloj: Date = new Date()): Promise<MetasDeLaSemana> {
  const semana = semanaActual(reloj);
  const [metas, tareas] = await Promise.all([
    consultar<MetaSemanal>(
      `SELECT id, tipo, categoria, objetivo FROM metas_semanales WHERE usuario_id = $1
       ORDER BY categoria IS NOT NULL, lower(coalesce(categoria, '')), tipo DESC, creada_en`,
      [usuarioId],
    ),
    // 7.8: por fecha de cierre (cuándo se trabajó), no por fecha límite.
    consultar<TareaCerrada>(
      `SELECT estado, to_char(fecha_cierre, 'YYYY-MM-DD') AS "fechaCierre", categoria, minutos_invertidos AS "minutosInvertidos"
       FROM tareas_personales
       WHERE usuario_id = $1 AND estado = 'Completada' AND fecha_cierre BETWEEN $2::date AND $3::date`,
      [usuarioId, semana.lunes, semana.domingo],
    ),
  ]);
  return { ...semana, metas: metas.map((m) => ({ ...m, ...progresoMeta(m, tareas, semana) })) };
}

/**
 * RB-16 y RB-17. La categoría se elige entre las del usuario y se guarda con su nombre guardado; vacía o null =
 * todas las categorías.
 */
export async function crearMetaSemanal(
  usuarioId: string,
  d: { tipo: TipoMeta; categoria?: string | null | undefined; objetivo?: string | number | undefined; horas?: string | number | undefined; minutos?: string | number | undefined },
): Promise<MetaSemanal> {
  const objetivo = d.tipo === 'tareas' ? validarObjetivoTareas(d.objetivo ?? '') : validarObjetivoMinutos(d.horas ?? '', d.minutos ?? '');
  let categoria: string | null = null;
  if (d.categoria?.trim()) {
    const [guardada] = await consultar<{ nombre: string }>('SELECT nombre FROM categorias WHERE usuario_id = $1 AND lower(nombre) = lower($2)', [
      usuarioId,
      validarNombreCategoria(d.categoria),
    ]);
    if (!guardada) throw new ErrorDeNegocio('CATEGORIA_NO_ENCONTRADA');
    categoria = guardada.nombre;
  }
  try {
    const [meta] = await consultar<MetaSemanal>(
      'INSERT INTO metas_semanales (usuario_id, tipo, categoria, objetivo) VALUES ($1, $2, $3, $4) RETURNING id, tipo, categoria, objetivo',
      [usuarioId, d.tipo, categoria, objetivo],
    );
    return meta as MetaSemanal;
  } catch (error) {
    const { code, constraint } = (error ?? {}) as { code?: string; constraint?: string };
    if (code === '23505' && constraint === 'idx_metas_semanales_unica') throw new ErrorDeNegocio('META_SEMANAL_DUPLICADA');
    throw error;
  }
}

export async function eliminarMetaSemanal(usuarioId: string, id: string): Promise<{ id: string }> {
  const [borrada] = await consultar<{ id: string }>('DELETE FROM metas_semanales WHERE id = $1 AND usuario_id = $2 RETURNING id', [id, usuarioId]);
  if (!borrada) throw new ErrorDeNegocio('META_SEMANAL_NO_ENCONTRADA');
  return borrada;
}
