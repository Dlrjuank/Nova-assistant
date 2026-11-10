import {
  CATEGORIA_POR_DEFECTO,
  LIMITE_LISTADO,
  MAX_FUENTES_WEB_POR_CATEGORIA,
  WEB_MAX_CARACTERES,
  WEB_RESULTADOS,
  WIKIPEDIA_AGENTE,
  WIKIPEDIA_API,
} from '@/lib/config/nova';
import { consultar, conTransaccion } from '@/lib/db/conexion';
import { llm } from '@/lib/llm/gemini';
import { SYSTEM_PROMPT_WEB } from '@/lib/llm/prompts';
import { normalizarConsulta, validarConsulta } from '@/lib/reglas/consulta';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { hoyBogota } from '@/lib/reglas/fechas';
import { esUrlDeWikipedia } from '@/lib/reglas/fuentesWeb';
import type { ArticuloWeb, FuenteGuardada, FuenteWeb, ResultadoWeb } from './tipos';

const TIEMPO_WIKIPEDIA_MS = 10_000;
const MAX_CARACTERES_EXTRACTO = 2_000; // por artículo: acota los tokens que se envían a Gemini

interface Articulo extends ArticuloWeb {
  extracto: string;
}

/** Los 3 primeros resultados de la búsqueda, con la introducción en texto plano, en una sola llamada. */
async function buscarArticulos(consulta: string): Promise<Articulo[]> {
  const parametros = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: consulta.slice(0, WEB_MAX_CARACTERES),
    gsrlimit: String(WEB_RESULTADOS),
    prop: 'extracts|info',
    exintro: '1',
    explaintext: '1',
    exlimit: String(WEB_RESULTADOS),
    inprop: 'url',
    utf8: '1',
  });
  let cuerpo: { query?: { pages?: Array<{ title?: string; fullurl?: string; extract?: string; index?: number }> } };
  try {
    const respuesta = await fetch(`${WIKIPEDIA_API}?${parametros}`, {
      headers: { 'User-Agent': WIKIPEDIA_AGENTE, 'Api-User-Agent': WIKIPEDIA_AGENTE },
      signal: AbortSignal.timeout(TIEMPO_WIKIPEDIA_MS),
    });
    if (!respuesta.ok) throw new Error(`Wikipedia respondió ${respuesta.status}`);
    cuerpo = await respuesta.json();
  } catch (error) {
    console.error('Fallo al consultar Wikipedia:', error instanceof Error ? error.message : error);
    throw new ErrorDeNegocio('ERROR_WIKIPEDIA');
  }
  // Con generator, las páginas no llegan en orden: `index` es la posición en la búsqueda.
  return (cuerpo.query?.pages ?? [])
    .filter((p) => p.title && p.fullurl)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .slice(0, WEB_RESULTADOS)
    .map((p) => ({
      titulo: p.title as string,
      url: p.fullurl as string,
      extracto: (p.extract ?? '').trim().slice(0, MAX_CARACTERES_EXTRACTO),
    }));
}

/** CU-06 y RB-58: busca y resume, sin guardar nada (RB-55). */
export async function buscarEnWikipedia(consulta: string): Promise<ResultadoWeb> {
  validarConsulta(consulta); // RN-02
  const texto = normalizarConsulta(consulta);
  const articulos = await buscarArticulos(texto);
  if (articulos.length === 0) {
    return { resumen: 'Wikipedia no encontró artículos para esta consulta. Pruebe con otras palabras.', url: '', articulos: [] };
  }
  const resumen = await llm.responder({
    sistema: SYSTEM_PROMPT_WEB,
    contexto: articulos.map((a) => `[${a.titulo}]\n${a.extracto || '(sin extracto)'}`).join('\n\n'),
    pregunta: texto,
  });
  return { resumen, url: articulos[0]?.url as string, articulos: articulos.map(({ titulo, url }) => ({ titulo, url })) };
}

type Consulta = <T>(sql: string, valores: unknown[]) => Promise<T[]>;

/** RN-05 y RB-55: la misma dirección no se repite en una categoría y cada categoría admite 20. */
async function revisarCupo(consulta: Consulta, usuarioId: string, categoria: string, url: string): Promise<number> {
  const [fila] = await consulta<{ n: number; repetida: boolean }>(
    `SELECT COUNT(*)::int AS n, COALESCE(bool_or(url = $3), false) AS repetida
     FROM fuentes_web WHERE usuario_id = $1 AND categoria = $2`,
    [usuarioId, categoria, url],
  );
  if (fila?.repetida) throw new ErrorDeNegocio('FUENTE_DUPLICADA', `Esta fuente ya está guardada en «${categoria}».`);
  if ((fila?.n ?? 0) >= MAX_FUENTES_WEB_POR_CATEGORIA) throw new ErrorDeNegocio('LIMITE_FUENTES');
  return fila?.n ?? 0;
}

/**
 * RB-55: guarda el resultado de una búsqueda. Primero se revisa sin gastar cuota; dentro de la transacción se revisa
 * otra vez con un bloqueo por usuario y categoría, para que dos toques seguidos no dupliquen ni pasen de 20.
 * Si Gemini falla, la fuente se guarda sin vector y se vectoriza al consultarla (M18).
 */
export async function guardarFuenteWeb(
  usuarioId: string,
  datos: { url: string; resumen: string; categoria?: string | undefined },
): Promise<FuenteGuardada> {
  if (!esUrlDeWikipedia(datos.url)) throw new ErrorDeNegocio('FUENTE_URL_INVALIDA');
  const categoria = datos.categoria?.trim() || CATEGORIA_POR_DEFECTO;
  await revisarCupo(consultar as Consulta, usuarioId, categoria, datos.url);

  const vector = await llm
    .generarEmbeddings([datos.resumen], { interactivo: true })
    .then(([v]) => (v ? JSON.stringify(v) : null))
    .catch((error: unknown) => {
      console.warn('La fuente se guarda sin vector:', error instanceof Error ? error.message : error);
      return null;
    });

  return conTransaccion(async (tx) => {
    const consulta: Consulta = async <T>(sql: string, valores: unknown[]) => (await tx.query(sql, valores)).rows as T[];
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`fuentes_web:${usuarioId}:${categoria}`]);
    const previas = await revisarCupo(consulta, usuarioId, categoria, datos.url);
    await tx.query(
      'INSERT INTO fuentes_web (categoria, url, extracto, fecha_guardado, usuario_id, vector) VALUES ($1, $2, $3, $4, $5, $6::vector)',
      [categoria, datos.url, datos.resumen, hoyBogota(), usuarioId, vector],
    );
    return { categoria, fuentesEnCategoria: previas + 1 };
  });
}

/** E10b2 (RB-54): las fuentes guardadas del usuario, de la más reciente a la más antigua. */
export async function listarFuentesWeb(usuarioId: string): Promise<FuenteWeb[]> {
  return consultar<FuenteWeb>(
    `SELECT id, categoria, url, extracto, fecha_guardado AS "fechaGuardado"
     FROM fuentes_web WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [usuarioId, LIMITE_LISTADO],
  );
}

/** E10b2 (RB-54): libera su cupo en la categoría (RN-05). */
export async function eliminarFuenteWeb(usuarioId: string, id: string): Promise<void> {
  const borradas = await consultar<{ id: string }>('DELETE FROM fuentes_web WHERE id = $1 AND usuario_id = $2 RETURNING id', [id, usuarioId]);
  if (borradas.length === 0) throw new ErrorDeNegocio('FUENTE_NO_ENCONTRADA');
}
