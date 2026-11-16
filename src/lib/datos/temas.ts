import { consultar } from '@/lib/db/conexion';
import { llm } from '@/lib/llm/gemini';
import { etiquetaFragmento } from '@/lib/llm/prompts';
import { consultaTemas, ESQUEMA_TEMAS, pedidoTemas, SYSTEM_PROMPT_TEMAS } from '@/lib/llm/temas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { hoyBogota } from '@/lib/reglas/fechas';
import { corteConFechaFutura, descripcionCorte, FRAGMENTOS_PARA_TEMAS, validarNombreTema, validarTemasPropuestos, type EstadoTema, type OrigenTema } from '@/lib/reglas/temas';
import { recuperarFragmentosDeDocumento } from './fragmentos';

/** E17 (6.8, 9.1): un tema de un corte. */
export interface Tema {
  id: string;
  corteId: string;
  nombre: string;
  origen: OrigenTema;
  estado: EstadoTema;
  fuente: string | null;
}

const COLUMNAS = 'id, corte_id AS "corteId", nombre, origen, estado, fuente';

/** RB-05 y temas repetidos: el índice único de la base decide, también con dos pedidos a la vez. */
function traducirDuplicado(error: unknown): never {
  const e = error as { code?: string; constraint?: string };
  if (e.code === '23505' && e.constraint === 'idx_temas_nombre') throw new ErrorDeNegocio('TEMA_DUPLICADO');
  throw error;
}

/** RB-01: solo los del usuario; con `materiaId`, solo los de esa materia. Confirmados primero, luego por nombre. */
export async function listarTemas(usuarioId: string, materiaId?: string | undefined): Promise<Tema[]> {
  return consultar<Tema>(
    `SELECT t.id, t.corte_id AS "corteId", t.nombre, t.origen, t.estado, t.fuente FROM temas t JOIN cortes c ON c.id = t.corte_id
     WHERE t.usuario_id = $1 AND ($2::uuid IS NULL OR c.materia_id = $2)
     ORDER BY t.estado = 'propuesto', lower(t.nombre)`,
    [usuarioId, materiaId ?? null],
  );
}

/** Un tema escrito a mano nace confirmado (6.8). El corte de otro usuario responde como inexistente. */
export async function crearTema(usuarioId: string, corteId: string, nombre: string): Promise<Tema> {
  const limpio = validarNombreTema(nombre);
  const [corte] = await consultar<{ id: string }>('SELECT id FROM cortes WHERE id = $1 AND usuario_id = $2', [corteId, usuarioId]);
  if (!corte) throw new ErrorDeNegocio('CORTE_NO_ENCONTRADO');
  try {
    const [tema] = await consultar<Tema>(
      `INSERT INTO temas (usuario_id, corte_id, nombre, origen, estado) VALUES ($1, $2, $3, 'manual', 'confirmado') RETURNING ${COLUMNAS}`,
      [usuarioId, corteId, limpio],
    );
    return tema as Tema;
  } catch (error) {
    return traducirDuplicado(error);
  }
}

/** Cambia el nombre y, con `confirmar`, lo confirma (un propuesto pasa a contar). */
export async function editarTema(usuarioId: string, id: string, d: { nombre?: string | undefined; confirmar?: boolean | undefined }): Promise<Tema> {
  const nombre = d.nombre === undefined ? null : validarNombreTema(d.nombre);
  if (nombre === null && !d.confirmar) throw new ErrorDeNegocio('DATOS_INVALIDOS');
  try {
    const [tema] = await consultar<Tema>(
      `UPDATE temas SET nombre = COALESCE($3, nombre), estado = CASE WHEN $4 THEN 'confirmado' ELSE estado END
       WHERE id = $1 AND usuario_id = $2 RETURNING ${COLUMNAS}`,
      [id, usuarioId, nombre, Boolean(d.confirmar)],
    );
    if (!tema) throw new ErrorDeNegocio('TEMA_NO_ENCONTRADO');
    return tema;
  } catch (error) {
    return traducirDuplicado(error);
  }
}

/** Eliminar un tema o descartar un propuesto (6.8: descartar lo borra). */
export async function eliminarTema(usuarioId: string, id: string): Promise<{ id: string }> {
  const filas = await consultar<{ id: string }>('DELETE FROM temas WHERE id = $1 AND usuario_id = $2 RETURNING id', [id, usuarioId]);
  if (filas.length === 0) throw new ErrorDeNegocio('TEMA_NO_ENCONTRADO');
  return { id };
}

/** Los PDF ya indexados de cada materia del usuario, para elegir de cuál proponer temas (9.1 paso 1). */
export async function documentosDeMaterias(usuarioId: string): Promise<Array<{ id: string; nombre: string; materiaId: string }>> {
  return consultar(
    `SELECT id, nombre_archivo AS nombre, materia_id AS "materiaId" FROM documentos
     WHERE usuario_id = $1 AND materia_id IS NOT NULL AND progreso IS NULL ORDER BY lower(nombre_archivo)`,
    [usuarioId],
  );
}

/**
 * 9.1: busca en el PDF elegido los fragmentos más parecidos a "temas, contenidos y unidades" del corte (hasta 6), le
 * pide al modelo los temas con su etiqueta y guarda como propuestos los que pasan la validación. RB-19 y RB-21 se
 * revisan antes de gastar cuota. Devuelve los temas guardados.
 */
export async function proponerTemas(usuarioId: string, corteId: string, documentoId: string, hoy: string = hoyBogota()): Promise<Tema[]> {
  const [corte] = await consultar<{ nombre: string; fecha: string | null; materia_id: string; materia: string; usa_cortes: boolean }>(
    `SELECT c.nombre, to_char(c.fecha, 'YYYY-MM-DD') AS fecha, c.materia_id, m.nombre AS materia, m.usa_cortes
     FROM cortes c JOIN materias m ON m.id = c.materia_id WHERE c.id = $1 AND c.usuario_id = $2`,
    [corteId, usuarioId],
  );
  if (!corte) throw new ErrorDeNegocio('CORTE_NO_ENCONTRADO');
  if (!corteConFechaFutura(corte.fecha, hoy)) {
    throw new ErrorDeNegocio('PLAN_SIN_FECHA', corte.usa_cortes ? 'Pon una fecha futura al corte para proponer temas.' : 'Pon una fecha final futura a la materia para proponer temas.');
  }
  const [documento] = await consultar<{ materia_id: string | null; progreso: number | null }>('SELECT materia_id, progreso FROM documentos WHERE id = $1 AND usuario_id = $2', [
    documentoId,
    usuarioId,
  ]);
  if (!documento) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
  if (documento.materia_id !== corte.materia_id) throw new ErrorDeNegocio('SIN_SYLLABUS'); // RB-21
  if (documento.progreso !== null) throw new ErrorDeNegocio('DOCUMENTO_INDEXANDO');

  const periodo = descripcionCorte(corte.materia, corte.nombre, corte.usa_cortes);
  const vector = await llm.generarEmbedding(consultaTemas(periodo));
  const fragmentos = await recuperarFragmentosDeDocumento(usuarioId, vector, FRAGMENTOS_PARA_TEMAS, documentoId);
  if (fragmentos.length === 0) throw new ErrorDeNegocio('SIN_TEMAS_PROPUESTOS');
  // El modelo ve "F1"…; se guarda la etiqueta legible ("syllabus.pdf · p. 2").
  const etiquetas = new Map(fragmentos.map((f, i) => [`F${i + 1}`, etiquetaFragmento(f)]));
  // Los que el corte ya tiene: el modelo los recibe para no repetirlos con otras palabras, y se descartan igual.
  const existentes = (await consultar<{ nombre: string }>('SELECT nombre FROM temas WHERE corte_id = $1 AND usuario_id = $2', [corteId, usuarioId])).map((e) => e.nombre);
  const crudos = await llm.generarJson({
    sistema: SYSTEM_PROMPT_TEMAS,
    contenido: pedidoTemas(
      fragmentos.map((f, i) => ({ etiqueta: `F${i + 1}`, contenido: f.contenido })),
      periodo,
      existentes,
    ),
    esquema: ESQUEMA_TEMAS,
    tiempoMaximoMs: 50_000,
  });
  const propuestos = validarTemasPropuestos(crudos, etiquetas, existentes);
  if (propuestos.length === 0) throw new ErrorDeNegocio('SIN_TEMAS_PROPUESTOS');
  // ON CONFLICT: si otra petición guardó el mismo tema a la vez, se queda el primero.
  return consultar<Tema>(
    `INSERT INTO temas (usuario_id, corte_id, nombre, origen, estado, fuente)
     SELECT $1, $2, x.nombre, 'asistente', 'propuesto', x.fuente FROM unnest($3::text[], $4::text[]) AS x(nombre, fuente)
     ON CONFLICT DO NOTHING RETURNING ${COLUMNAS}`,
    [usuarioId, corteId, propuestos.map((p) => p.nombre), propuestos.map((p) => p.fuente)],
  );
}
