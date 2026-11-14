import type { PoolClient } from 'pg';
import { consultar, conTransaccion } from '@/lib/db/conexion';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { esFechaISOValida } from '@/lib/reglas/fechas';
import {
  cortesAlDividir,
  MAX_CORTES_MATERIA,
  NOMBRE_CORTE_UNICO,
  puedeQuitarCortes,
  validarCreditos,
  validarDocente,
  validarNombreComponente,
  validarNombreCorte,
  validarNombreMateria,
  validarNombreNota,
  validarNota,
  validarPorcentaje,
} from '@/lib/reglas/notas';
import { resolverCategoria } from './categorias';
import { obtenerPreferencias } from './configuracion';

/**
 * E12 (PLAN_AMPLIACION 5.7, 6.4; RB-05 a RB-10, RB-35): materias, cortes, componentes y notas del usuario. Todo
 * filtra por `usuario_id`: lo de otro usuario responde como inexistente (RB-01). Los cálculos están en
 * `src/lib/reglas/notas.ts`; aquí solo se guarda.
 */

export interface NotaRegistrada {
  id: string;
  orden: number;
  nombre: string | null;
  /** Centésimas, o null si está "sin nota" (pendiente). */
  nota: number | null;
  fecha: string | null;
}

export interface ComponenteMateria {
  id: string;
  orden: number;
  nombre: string;
  /** Centésimas, dentro de su corte. */
  porcentaje: number;
  notas: NotaRegistrada[];
}

export interface CorteMateria {
  id: string;
  orden: number;
  nombre: string;
  /** Centésimas, dentro de la materia. */
  porcentaje: number;
  fecha: string | null;
  componentes: ComponenteMateria[];
}

export interface Materia {
  id: string;
  nombre: string;
  creditos: number;
  docente: string | null;
  usaCortes: boolean;
  cortes: CorteMateria[];
}

/** RB-05 y nombres de componente repetidos: el índice único de la base decide, también con dos pedidos a la vez. */
function traducirDuplicado(error: unknown): never {
  const e = error as { code?: string; constraint?: string };
  if (e.code === '23505' && e.constraint === 'idx_materias_nombre') throw new ErrorDeNegocio('MATERIA_DUPLICADA');
  if (e.code === '23505' && e.constraint === 'idx_componentes_nombre') throw new ErrorDeNegocio('COMPONENTE_DUPLICADO');
  throw error;
}

function validarFecha(fecha: string | null | undefined): string | null {
  if (fecha === null || fecha === undefined || fecha.trim() === '') return null;
  if (!esFechaISOValida(fecha.trim())) throw new ErrorDeNegocio('FECHA_INVALIDA');
  return fecha.trim();
}

const FECHA = (columna: string) => `to_char(${columna}, 'YYYY-MM-DD')`;

/** E12: las materias del usuario con sus cortes, componentes y notas, en orden. Con `id`, solo esa. */
export async function listarMaterias(usuarioId: string, id?: string | undefined): Promise<Materia[]> {
  const materias = await consultar<{ id: string; nombre: string; creditos: number; docente: string | null; usa_cortes: boolean }>(
    `SELECT id, nombre, creditos, docente, usa_cortes FROM materias
     WHERE usuario_id = $1 AND ($2::uuid IS NULL OR id = $2) ORDER BY lower(nombre), creada_en`,
    [usuarioId, id ?? null],
  );
  if (materias.length === 0) return [];
  const ids = materias.map((m) => m.id);
  const cortes = await consultar<{ id: string; materia_id: string; orden: number; nombre: string; porcentaje: number; fecha: string | null }>(
    `SELECT id, materia_id, orden, nombre, porcentaje, ${FECHA('fecha')} AS fecha FROM cortes WHERE usuario_id = $1 AND materia_id = ANY($2::uuid[]) ORDER BY orden`,
    [usuarioId, ids],
  );
  const componentes = await consultar<{ id: string; corte_id: string; orden: number; nombre: string; porcentaje: number }>(
    'SELECT id, corte_id, orden, nombre, porcentaje FROM componentes WHERE usuario_id = $1 AND corte_id = ANY($2::uuid[]) ORDER BY orden, lower(nombre)',
    [usuarioId, cortes.map((c) => c.id)],
  );
  const notas = await consultar<{ id: string; componente_id: string; orden: number; nombre: string | null; nota: number | null; fecha: string | null }>(
    `SELECT id, componente_id, orden, nombre, nota, ${FECHA('fecha')} AS fecha FROM notas WHERE usuario_id = $1 AND componente_id = ANY($2::uuid[]) ORDER BY orden, id`,
    [usuarioId, componentes.map((c) => c.id)],
  );
  const notasDe = new Map<string, NotaRegistrada[]>();
  for (const n of notas) notasDe.set(n.componente_id, [...(notasDe.get(n.componente_id) ?? []), { id: n.id, orden: n.orden, nombre: n.nombre, nota: n.nota, fecha: n.fecha }]);
  const componentesDe = new Map<string, ComponenteMateria[]>();
  for (const c of componentes) {
    componentesDe.set(c.corte_id, [...(componentesDe.get(c.corte_id) ?? []), { id: c.id, orden: c.orden, nombre: c.nombre, porcentaje: c.porcentaje, notas: notasDe.get(c.id) ?? [] }]);
  }
  const cortesDe = new Map<string, CorteMateria[]>();
  for (const c of cortes) {
    cortesDe.set(c.materia_id, [
      ...(cortesDe.get(c.materia_id) ?? []),
      { id: c.id, orden: c.orden, nombre: c.nombre, porcentaje: c.porcentaje, fecha: c.fecha, componentes: componentesDe.get(c.id) ?? [] },
    ]);
  }
  return materias.map((m) => ({ id: m.id, nombre: m.nombre, creditos: m.creditos, docente: m.docente, usaCortes: m.usa_cortes, cortes: cortesDe.get(m.id) ?? [] }));
}

export async function obtenerMateria(usuarioId: string, id: string): Promise<Materia> {
  const [materia] = await listarMaterias(usuarioId, id);
  if (!materia) throw new ErrorDeNegocio('MATERIA_NO_ENCONTRADA');
  return materia;
}

export interface DatosMateria {
  nombre: string;
  creditos: string | number;
  docente?: string | null | undefined;
}

/**
 * 6.4: la materia nace sin cortes, con su corte único de 100 % (oculto), y con una categoría de tareas de su mismo
 * nombre si no existe (RB-33).
 */
export async function crearMateria(usuarioId: string, d: DatosMateria): Promise<{ id: string; categoria: string }> {
  const nombre = validarNombreMateria(d.nombre);
  const creditos = validarCreditos(d.creditos);
  const docente = validarDocente(d.docente);
  return conTransaccion(async (tx) => {
    const { rows } = await tx
      .query<{ id: string }>('INSERT INTO materias (usuario_id, nombre, creditos, docente) VALUES ($1, $2, $3, $4) RETURNING id', [usuarioId, nombre, creditos, docente])
      .catch(traducirDuplicado);
    const id = rows[0]?.id as string;
    await tx.query('INSERT INTO cortes (materia_id, usuario_id, orden, nombre, porcentaje) VALUES ($1, $2, 1, $3, 10000)', [id, usuarioId, NOMBRE_CORTE_UNICO]);
    const categoria = await resolverCategoria(tx, usuarioId, nombre);
    return { id, categoria };
  });
}

export async function editarMateria(usuarioId: string, id: string, d: { [K in keyof DatosMateria]?: DatosMateria[K] | undefined }): Promise<{ id: string }> {
  const cambios: string[] = [];
  const valores: unknown[] = [id, usuarioId];
  if (d.nombre !== undefined) cambios.push(`nombre = $${valores.push(validarNombreMateria(d.nombre))}`);
  if (d.creditos !== undefined) cambios.push(`creditos = $${valores.push(validarCreditos(d.creditos))}`);
  if (d.docente !== undefined) cambios.push(`docente = $${valores.push(validarDocente(d.docente))}`);
  if (cambios.length === 0) throw new ErrorDeNegocio('DATOS_INVALIDOS');
  const filas = await consultar<{ id: string }>(`UPDATE materias SET ${cambios.join(', ')} WHERE id = $1 AND usuario_id = $2 RETURNING id`, valores).catch(traducirDuplicado);
  if (filas.length === 0) throw new ErrorDeNegocio('MATERIA_NO_ENCONTRADA');
  return { id };
}

/** Borra la materia con sus cortes, componentes y notas; sus documentos quedan sin materia. La categoría se conserva. */
export async function eliminarMateria(usuarioId: string, id: string): Promise<{ id: string }> {
  const filas = await consultar<{ id: string }>('DELETE FROM materias WHERE id = $1 AND usuario_id = $2 RETURNING id', [id, usuarioId]);
  if (filas.length === 0) throw new ErrorDeNegocio('MATERIA_NO_ENCONTRADA');
  return { id };
}

/** La materia bloqueada hasta el final de la transacción, para que dos cambios de cortes no se mezclen. */
async function bloquearMateria(tx: PoolClient, usuarioId: string, id: string): Promise<{ usa_cortes: boolean }> {
  const { rows } = await tx.query<{ usa_cortes: boolean }>('SELECT usa_cortes FROM materias WHERE id = $1 AND usuario_id = $2 FOR UPDATE', [id, usuarioId]);
  if (!rows[0]) throw new ErrorDeNegocio('MATERIA_NO_ENCONTRADA');
  return rows[0];
}

/**
 * 6.4 "Dividir en cortes": el corte único pasa a ser el Corte 1 (conserva sus componentes) con el primer
 * porcentaje de la plantilla de Configuración, y se agregan los demás sin componentes.
 */
export async function dividirEnCortes(usuarioId: string, id: string): Promise<{ cortes: number }> {
  const { cortesDefecto } = await obtenerPreferencias(usuarioId);
  return conTransaccion(async (tx) => {
    const materia = await bloquearMateria(tx, usuarioId, id);
    if (materia.usa_cortes) throw new ErrorDeNegocio('DATOS_INVALIDOS');
    const nuevos = cortesAlDividir(cortesDefecto);
    const [primero, ...resto] = nuevos;
    await tx.query('UPDATE cortes SET orden = $3, nombre = $4, porcentaje = $5 WHERE materia_id = $1 AND usuario_id = $2', [
      id,
      usuarioId,
      primero?.orden,
      primero?.nombre,
      primero?.porcentaje,
    ]);
    for (const c of resto) {
      await tx.query('INSERT INTO cortes (materia_id, usuario_id, orden, nombre, porcentaje) VALUES ($1, $2, $3, $4, $5)', [id, usuarioId, c.orden, c.nombre, c.porcentaje]);
    }
    await tx.query('UPDATE materias SET usa_cortes = true WHERE id = $1', [id]);
    return { cortes: nuevos.length };
  });
}

/** RB-35: los cortes solo se quitan cuando queda uno; ese corte vuelve a 100 % y queda oculto. */
export async function quitarCortes(usuarioId: string, id: string): Promise<{ id: string }> {
  return conTransaccion(async (tx) => {
    const materia = await bloquearMateria(tx, usuarioId, id);
    if (!materia.usa_cortes) return { id };
    const { rows } = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM cortes WHERE materia_id = $1 AND usuario_id = $2', [id, usuarioId]);
    if (!puedeQuitarCortes(rows[0]?.n ?? 0)) throw new ErrorDeNegocio('QUITAR_CORTES_INVALIDO');
    await tx.query('UPDATE cortes SET orden = 1, nombre = $3, porcentaje = 10000 WHERE materia_id = $1 AND usuario_id = $2', [id, usuarioId, NOMBRE_CORTE_UNICO]);
    await tx.query('UPDATE materias SET usa_cortes = false WHERE id = $1', [id]);
    return { id };
  });
}

export interface DatosCorte {
  id?: string | undefined;
  nombre: string;
  porcentaje: string | number;
  fecha?: string | null | undefined;
}

/**
 * 6.4: los cortes en bloque, en el orden de la lista: los que traen `id` se actualizan, los nuevos se crean y los
 * que faltan se borran con sus componentes (la pantalla lo confirma antes). Las sumas distintas de 100 % se
 * guardan: es un aviso (RB-07). En una materia sin cortes solo cambia la fecha final de su corte único.
 */
export async function guardarCortes(usuarioId: string, materiaId: string, lista: readonly DatosCorte[]): Promise<{ cortes: number }> {
  return conTransaccion(async (tx) => {
    const materia = await bloquearMateria(tx, usuarioId, materiaId);
    const { rows: existentes } = await tx.query<{ id: string }>('SELECT id FROM cortes WHERE materia_id = $1 AND usuario_id = $2', [materiaId, usuarioId]);
    const propios = new Set(existentes.map((c) => c.id));
    if (!materia.usa_cortes) {
      const [unico] = lista;
      if (lista.length !== 1 || !unico?.id || !propios.has(unico.id)) throw new ErrorDeNegocio('DATOS_INVALIDOS');
      await tx.query('UPDATE cortes SET fecha = $3 WHERE id = $1 AND usuario_id = $2', [unico.id, usuarioId, validarFecha(unico.fecha)]);
      return { cortes: 1 };
    }
    if (lista.length === 0) throw new ErrorDeNegocio('SIN_CORTES');
    if (lista.length > MAX_CORTES_MATERIA) throw new ErrorDeNegocio('DATOS_INVALIDOS');
    const limpios = lista.map((c) => ({ id: c.id, nombre: validarNombreCorte(c.nombre), porcentaje: validarPorcentaje(c.porcentaje), fecha: validarFecha(c.fecha) }));
    const conId = limpios.filter((c) => c.id);
    if (conId.some((c) => !propios.has(c.id as string)) || new Set(conId.map((c) => c.id)).size !== conId.length) throw new ErrorDeNegocio('CORTE_NO_ENCONTRADO');
    const quedan = new Set(conId.map((c) => c.id as string));
    const borrar = [...propios].filter((id) => !quedan.has(id));
    if (borrar.length > 0) await tx.query('DELETE FROM cortes WHERE id = ANY($1::uuid[]) AND usuario_id = $2', [borrar, usuarioId]);
    // El orden es único por materia: primero se corren todos fuera del rango y después se ponen en su lugar.
    await tx.query('UPDATE cortes SET orden = orden + 100 WHERE materia_id = $1 AND usuario_id = $2', [materiaId, usuarioId]);
    for (const [i, c] of limpios.entries()) {
      if (c.id) {
        await tx.query('UPDATE cortes SET orden = $3, nombre = $4, porcentaje = $5, fecha = $6 WHERE id = $1 AND usuario_id = $2', [c.id, usuarioId, i + 1, c.nombre, c.porcentaje, c.fecha]);
      } else {
        await tx.query('INSERT INTO cortes (materia_id, usuario_id, orden, nombre, porcentaje, fecha) VALUES ($1, $2, $3, $4, $5, $6)', [materiaId, usuarioId, i + 1, c.nombre, c.porcentaje, c.fecha]);
      }
    }
    return { cortes: limpios.length };
  });
}

export interface DatosComponente {
  nombre: string;
  porcentaje: string | number;
}

/** RB-08 y RB-10: el porcentaje se valida; la suma distinta de 100 % se guarda y la pantalla avisa. */
export async function crearComponente(usuarioId: string, corteId: string, d: DatosComponente): Promise<{ id: string }> {
  const nombre = validarNombreComponente(d.nombre);
  const porcentaje = validarPorcentaje(d.porcentaje);
  return conTransaccion(async (tx) => {
    const { rows: corte } = await tx.query('SELECT 1 FROM cortes WHERE id = $1 AND usuario_id = $2 FOR UPDATE', [corteId, usuarioId]);
    if (!corte[0]) throw new ErrorDeNegocio('CORTE_NO_ENCONTRADO');
    const { rows } = await tx
      .query<{ id: string }>(
        `INSERT INTO componentes (corte_id, usuario_id, orden, nombre, porcentaje)
         VALUES ($1, $2, (SELECT COALESCE(max(orden), 0) + 1 FROM componentes WHERE corte_id = $1), $3, $4) RETURNING id`,
        [corteId, usuarioId, nombre, porcentaje],
      )
      .catch(traducirDuplicado);
    return { id: rows[0]?.id as string };
  });
}

export async function editarComponente(usuarioId: string, id: string, d: { [K in keyof DatosComponente]?: DatosComponente[K] | undefined }): Promise<{ id: string }> {
  const cambios: string[] = [];
  const valores: unknown[] = [id, usuarioId];
  if (d.nombre !== undefined) cambios.push(`nombre = $${valores.push(validarNombreComponente(d.nombre))}`);
  if (d.porcentaje !== undefined) cambios.push(`porcentaje = $${valores.push(validarPorcentaje(d.porcentaje))}`);
  if (cambios.length === 0) throw new ErrorDeNegocio('DATOS_INVALIDOS');
  const filas = await consultar<{ id: string }>(`UPDATE componentes SET ${cambios.join(', ')} WHERE id = $1 AND usuario_id = $2 RETURNING id`, valores).catch(traducirDuplicado);
  if (filas.length === 0) throw new ErrorDeNegocio('COMPONENTE_NO_ENCONTRADO');
  return { id };
}

export async function eliminarComponente(usuarioId: string, id: string): Promise<{ id: string }> {
  const filas = await consultar<{ id: string }>('DELETE FROM componentes WHERE id = $1 AND usuario_id = $2 RETURNING id', [id, usuarioId]);
  if (filas.length === 0) throw new ErrorDeNegocio('COMPONENTE_NO_ENCONTRADO');
  return { id };
}

export interface DatosNota {
  nombre?: string | null | undefined;
  /** Texto del campo ("3,75") o centésimas; vacía o null = "sin nota". */
  nota?: string | number | null | undefined;
  fecha?: string | null | undefined;
}

/** RB-09: la nota de 0,0 a 5,0; vacía queda "sin nota" y cuenta como pendiente (7.3). */
export async function crearNota(usuarioId: string, componenteId: string, d: DatosNota): Promise<{ id: string }> {
  const nombre = validarNombreNota(d.nombre);
  const nota = validarNota(d.nota);
  const fecha = validarFecha(d.fecha);
  return conTransaccion(async (tx) => {
    const { rows: componente } = await tx.query('SELECT 1 FROM componentes WHERE id = $1 AND usuario_id = $2 FOR UPDATE', [componenteId, usuarioId]);
    if (!componente[0]) throw new ErrorDeNegocio('COMPONENTE_NO_ENCONTRADO');
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO notas (componente_id, usuario_id, orden, nombre, nota, fecha)
       VALUES ($1, $2, (SELECT COALESCE(max(orden), 0) + 1 FROM notas WHERE componente_id = $1), $3, $4, $5) RETURNING id`,
      [componenteId, usuarioId, nombre, nota, fecha],
    );
    return { id: rows[0]?.id as string };
  });
}

export async function editarNota(usuarioId: string, id: string, d: DatosNota): Promise<{ id: string }> {
  const cambios: string[] = [];
  const valores: unknown[] = [id, usuarioId];
  if (d.nombre !== undefined) cambios.push(`nombre = $${valores.push(validarNombreNota(d.nombre))}`);
  if (d.nota !== undefined) cambios.push(`nota = $${valores.push(validarNota(d.nota))}`);
  if (d.fecha !== undefined) cambios.push(`fecha = $${valores.push(validarFecha(d.fecha))}`);
  if (cambios.length === 0) throw new ErrorDeNegocio('DATOS_INVALIDOS');
  const filas = await consultar<{ id: string }>(`UPDATE notas SET ${cambios.join(', ')} WHERE id = $1 AND usuario_id = $2 RETURNING id`, valores);
  if (filas.length === 0) throw new ErrorDeNegocio('NOTA_NO_ENCONTRADA');
  return { id };
}

export async function eliminarNota(usuarioId: string, id: string): Promise<{ id: string }> {
  const filas = await consultar<{ id: string }>('DELETE FROM notas WHERE id = $1 AND usuario_id = $2 RETURNING id', [id, usuarioId]);
  if (filas.length === 0) throw new ErrorDeNegocio('NOTA_NO_ENCONTRADA');
  return { id };
}
