import { CATEGORIA_POR_DEFECTO } from '@/lib/config/nova';
import { conTransaccion, consultar } from '@/lib/db/conexion';
import {
  COLOR_SIN_CATEGORIA,
  esGeneral,
  siguienteColorLibre,
  validarColorCategoria,
  validarNombreCategoria,
} from '@/lib/reglas/categorias';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import type { Categoria } from './tipos';

/** El nombre ya existe para ese usuario (índice único sin distinguir mayúsculas). */
function esDuplicada(error: unknown): boolean {
  const { code, constraint } = (error ?? {}) as { code?: string; constraint?: string };
  return code === '23505' && constraint === 'categorias_nombre_unico';
}

const COLUMNAS = `c.id, c.nombre, c.color,
  (SELECT COUNT(*) FROM tareas_personales t
   WHERE t.usuario_id = c.usuario_id AND lower(btrim(t.categoria)) = lower(c.nombre))::bigint AS tareas`;

/** "General" siempre existe (PLAN_AMPLIACION 6.2): se crea la primera vez que se necesita. */
async function asegurarGeneral(usuarioId: string): Promise<void> {
  await consultar(
    `INSERT INTO categorias (usuario_id, nombre, color) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [usuarioId, CATEGORIA_POR_DEFECTO, COLOR_SIN_CATEGORIA],
  );
}

/** RB-01: solo las del usuario. General primero y las demás por nombre, con cuántas tareas tiene cada una. */
export async function listarCategorias(usuarioId: string): Promise<Categoria[]> {
  await asegurarGeneral(usuarioId);
  return consultar<Categoria>(
    `SELECT ${COLUMNAS} FROM categorias c
     WHERE c.usuario_id = $1
     ORDER BY lower(c.nombre) = lower($2) DESC, lower(c.nombre)`,
    [usuarioId, CATEGORIA_POR_DEFECTO],
  );
}

/** RB-02 y RB-03. Sin color, el siguiente libre de la paleta. */
export async function crearCategoria(usuarioId: string, d: { nombre: string; color?: string | undefined }): Promise<Categoria> {
  // Se valida todo antes de tocar la base.
  const nombre = validarNombreCategoria(d.nombre);
  let color = d.color === undefined ? undefined : validarColorCategoria(d.color);
  await asegurarGeneral(usuarioId);
  if (!color) {
    const usados = await consultar<{ color: string }>('SELECT color FROM categorias WHERE usuario_id = $1', [usuarioId]);
    color = siguienteColorLibre(usados.map((u) => u.color));
  }
  try {
    const [creada] = await consultar<{ id: string }>(
      'INSERT INTO categorias (usuario_id, nombre, color) VALUES ($1, $2, $3) RETURNING id',
      [usuarioId, nombre, color],
    );
    const [categoria] = await consultar<Categoria>(`SELECT ${COLUMNAS} FROM categorias c WHERE c.id = $1`, [creada?.id]);
    return categoria as Categoria;
  } catch (error) {
    if (esDuplicada(error)) throw new ErrorDeNegocio('CATEGORIA_DUPLICADA');
    throw error;
  }
}

/**
 * Renombrar y cambiar el color. Renombrar actualiza también la categoría de las tareas del usuario, en la
 * misma transacción (PLAN_AMPLIACION 6.2). General no se renombra (sí se le puede cambiar el color).
 */
export async function actualizarCategoria(
  usuarioId: string,
  id: string,
  d: { nombre?: string | undefined; color?: string | undefined },
): Promise<Categoria> {
  const nombreNuevo = d.nombre === undefined ? undefined : validarNombreCategoria(d.nombre);
  const color = d.color === undefined ? undefined : validarColorCategoria(d.color);
  try {
    await conTransaccion(async (tx) => {
      const { rows } = await tx.query<{ nombre: string }>(
        'SELECT nombre FROM categorias WHERE id = $1 AND usuario_id = $2 FOR UPDATE',
        [id, usuarioId],
      );
      const actual = rows[0];
      if (!actual) throw new ErrorDeNegocio('CATEGORIA_NO_ENCONTRADA');
      const renombra = nombreNuevo !== undefined && nombreNuevo !== actual.nombre;
      if (renombra && esGeneral(actual.nombre)) {
        throw new ErrorDeNegocio('CATEGORIA_GENERAL', 'La categoría General no se puede renombrar.');
      }
      await tx.query(
        `UPDATE categorias SET nombre = COALESCE($3, nombre), color = COALESCE($4, color)
         WHERE id = $1 AND usuario_id = $2`,
        [id, usuarioId, renombra ? nombreNuevo : null, color ?? null],
      );
      if (renombra) {
        await tx.query(
          `UPDATE tareas_personales SET categoria = $3
           WHERE usuario_id = $1 AND lower(btrim(categoria)) = lower($2)`,
          [usuarioId, actual.nombre, nombreNuevo],
        );
      }
    });
  } catch (error) {
    if (esDuplicada(error)) throw new ErrorDeNegocio('CATEGORIA_DUPLICADA');
    throw error;
  }
  const [categoria] = await consultar<Categoria>(`SELECT ${COLUMNAS} FROM categorias c WHERE c.id = $1 AND c.usuario_id = $2`, [
    id,
    usuarioId,
  ]);
  return categoria as Categoria;
}

/** RB-04: sus tareas pasan a General; General no se elimina. Devuelve cuántas tareas se movieron. */
export async function eliminarCategoria(usuarioId: string, id: string): Promise<{ id: string; tareasMovidas: number }> {
  return conTransaccion(async (tx) => {
    const { rows } = await tx.query<{ nombre: string }>(
      'SELECT nombre FROM categorias WHERE id = $1 AND usuario_id = $2 FOR UPDATE',
      [id, usuarioId],
    );
    const actual = rows[0];
    if (!actual) throw new ErrorDeNegocio('CATEGORIA_NO_ENCONTRADA');
    if (esGeneral(actual.nombre)) throw new ErrorDeNegocio('CATEGORIA_GENERAL');
    await tx.query(
      'INSERT INTO categorias (usuario_id, nombre, color) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [usuarioId, CATEGORIA_POR_DEFECTO, COLOR_SIN_CATEGORIA],
    );
    const movidas = await tx.query(
      `UPDATE tareas_personales SET categoria = $3
       WHERE usuario_id = $1 AND lower(btrim(categoria)) = lower($2)`,
      [usuarioId, actual.nombre, CATEGORIA_POR_DEFECTO],
    );
    await tx.query('DELETE FROM categorias WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    return { id, tareasMovidas: movidas.rowCount ?? 0 };
  });
}
