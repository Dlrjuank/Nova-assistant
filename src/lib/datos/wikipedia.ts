import {
  CATEGORIA_POR_DEFECTO,
  MAX_FUENTES_WEB_POR_CATEGORIA,
  WEB_RESULTADOS,
  WIKIPEDIA_AGENTE,
  WIKIPEDIA_API,
} from '@/lib/config/nova';
import { consultar } from '@/lib/db/conexion';
import { llm } from '@/lib/llm/gemini';
import { SYSTEM_PROMPT_WEB } from '@/lib/llm/prompts';
import { normalizarConsulta, validarConsulta } from '@/lib/reglas/consulta';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { hoyBogota } from '@/lib/reglas/fechas';
import type { ArticuloWeb, ResultadoWeb } from './tipos';

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
    gsrsearch: consulta,
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

async function contarFuentes(categoria: string): Promise<number> {
  const [fila] = await consultar<{ n: number }>('SELECT COUNT(*)::bigint AS n FROM fuentes_web WHERE categoria = $1', [
    categoria,
  ]);
  return fila?.n ?? 0;
}

/**
 * CU-06 (RN-02, RN-05). El límite se revisa antes de llamar a Wikipedia y a Gemini, para no gastar cuota
 * en una búsqueda que no se podría guardar, y otra vez al guardar. Sin resultados no se guarda nada.
 */
export async function buscarEnWikipedia(consulta: string, categoria?: string | undefined): Promise<ResultadoWeb> {
  validarConsulta(consulta); // RN-02
  const texto = normalizarConsulta(consulta);
  const cat = categoria?.trim() || CATEGORIA_POR_DEFECTO;
  if ((await contarFuentes(cat)) >= MAX_FUENTES_WEB_POR_CATEGORIA) throw new ErrorDeNegocio('LIMITE_FUENTES');

  const articulos = await buscarArticulos(texto);
  const articulosWeb = articulos.map(({ titulo, url }) => ({ titulo, url }));
  if (articulos.length === 0) {
    return {
      resumen: 'Wikipedia no encontró artículos para esta consulta. Pruebe con otras palabras.',
      url: '',
      guardada: false,
      categoria: cat,
      articulos: [],
      fuentesEnCategoria: await contarFuentes(cat),
    };
  }

  const resumen = await llm.responder({
    sistema: SYSTEM_PROMPT_WEB,
    contexto: articulos.map((a) => `[${a.titulo}]\n${a.extracto || '(sin extracto)'}`).join('\n\n'),
    pregunta: texto,
  });

  // Inserta solo si sigue habiendo cupo: dos búsquedas simultáneas no pueden pasar de 20.
  // Los casts son necesarios: sin ellos Postgres deduce text y varchar para $1 y rechaza la consulta (42P08).
  const guardadas = await consultar<{ id: string }>(
    `INSERT INTO fuentes_web (categoria, url, extracto, fecha_guardado)
     SELECT $1::varchar, $2::text, $3::text, $4::date
     WHERE (SELECT COUNT(*) FROM fuentes_web WHERE categoria = $1::varchar) < $5::int
     RETURNING id`,
    [cat, articulos[0]?.url, resumen, hoyBogota(), MAX_FUENTES_WEB_POR_CATEGORIA],
  );
  if (guardadas.length === 0) throw new ErrorDeNegocio('LIMITE_FUENTES');

  return {
    resumen,
    url: articulos[0]?.url as string,
    guardada: true,
    categoria: cat,
    articulos: articulosWeb,
    fuentesEnCategoria: await contarFuentes(cat),
  };
}
