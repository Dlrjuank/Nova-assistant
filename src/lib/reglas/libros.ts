import { FRAGMENTO_PALABRAS, FRAGMENTO_SOLAPAMIENTO, PDF_MAX_PAGINAS } from '@/lib/config/nova';
import { ErrorDeNegocio } from './errores';

/** E10b (PLAN_AMPLIACION 5.9, RB-36 a RB-38): páginas y capítulos de un PDF. Funciones puras. */

export const MENSAJE_REINDEXAR = 'Vuelve a indexar este documento para ver páginas y capítulos.';
export const MENSAJE_SIN_CAPITULOS = 'No encontré capítulos en este PDF. Puedes preguntar por página.';

/** Del índice interno del PDF. `pagina` empieza en 1; `nivel` 1 es lo más alto. */
export interface EntradaIndice {
  titulo: string;
  pagina: number;
  nivel: number;
}

export interface FragmentoLibro {
  numero: number;
  contenido: string;
  paginaInicio: number;
  paginaFin: number;
  etiquetaPaginas: string;
}

export interface CapituloLibro {
  orden: number;
  nivel: number;
  titulo: string;
  paginaInicio: number;
  paginaFin: number;
  etiquetaPaginas: string;
}

type Etiquetas = ReadonlyArray<string | null> | null | undefined;

/** RB-38. */
export function validarPaginas(paginas: number): void {
  if (paginas > PDF_MAX_PAGINAS) {
    throw new ErrorDeNegocio('PDF_MUY_LARGO', `El PDF tiene ${paginas} páginas; el máximo es ${PDF_MAX_PAGINAS}.`);
  }
}

/** RB-36: el número impreso si el PDF lo trae; si no, el número de página del PDF. "45" o "45–46". */
export function etiquetaDePaginas(inicio: number, fin: number, etiquetas?: Etiquetas): string {
  const nombre = (p: number) => etiquetas?.[p - 1]?.trim() || String(p);
  return inicio === fin ? nombre(inicio) : `${nombre(inicio)}–${nombre(fin)}`;
}

/** RB-36: cómo se cita: "p. 45" o "pp. 45–46". */
export function citaDePaginas(etiqueta: string): string {
  return etiqueta.includes('–') ? `pp. ${etiqueta}` : `p. ${etiqueta}`;
}

/** E10c: en qué palabra del documento empieza cada página, con el mismo conteo de `fragmentarPaginas`. */
export function inicioDePaginas(paginas: readonly string[]): number[] {
  let palabras = 0;
  return paginas.map((texto) => {
    const inicio = palabras;
    palabras += texto.trim().split(/\s+/).filter((p) => p !== '').length;
    return inicio;
  });
}

/**
 * RB-39: deja de cada fragmento solo las palabras de la página pedida (`pagina` empieza en 1), sin repetir el
 * solapamiento entre fragmentos. El fragmento n empieza en la palabra (n − 1) × paso (RN-10).
 */
export function soloTextoDePagina<T extends { numero: number; contenido: string }>(fragmentos: readonly T[], pagina: number, inicios: readonly number[]): T[] {
  const paso = FRAGMENTO_PALABRAS - FRAGMENTO_SOLAPAMIENTO;
  const desde = inicios[pagina - 1];
  if (desde === undefined) return [];
  const hasta = inicios[pagina] ?? Number.POSITIVE_INFINITY;
  const resultado: T[] = [];
  let cubierto = desde;
  for (const f of [...fragmentos].sort((a, b) => a.numero - b.numero)) {
    const inicio = (f.numero - 1) * paso;
    const palabras = f.contenido.split(' ');
    const a = Math.max(cubierto, inicio);
    const b = Math.min(hasta, inicio + palabras.length);
    if (a >= b) continue;
    resultado.push({ ...f, contenido: palabras.slice(a - inicio, b - inicio).join(' ') });
    cubierto = b;
  }
  return resultado;
}

/** RN-10 sobre las páginas: los mismos trozos que `fragmentar`, y cada uno sabe qué páginas toca su texto. */
export function fragmentarPaginas(paginas: readonly string[], etiquetas?: Etiquetas): FragmentoLibro[] {
  const palabras: string[] = [];
  const paginaDe: number[] = [];
  paginas.forEach((texto, indice) => {
    for (const palabra of texto.trim().split(/\s+/)) {
      if (palabra === '') continue;
      palabras.push(palabra);
      paginaDe.push(indice + 1);
    }
  });
  if (palabras.length === 0) return [];

  const paso = FRAGMENTO_PALABRAS - FRAGMENTO_SOLAPAMIENTO;
  const fragmentos: FragmentoLibro[] = [];
  for (let inicio = 0; ; inicio += paso) {
    const fin = Math.min(inicio + FRAGMENTO_PALABRAS, palabras.length);
    const paginaInicio = paginaDe[inicio] as number;
    const paginaFin = paginaDe[fin - 1] as number;
    fragmentos.push({
      numero: fragmentos.length + 1,
      contenido: palabras.slice(inicio, fin).join(' '),
      paginaInicio,
      paginaFin,
      etiquetaPaginas: etiquetaDePaginas(paginaInicio, paginaFin, etiquetas),
    });
    if (fin >= palabras.length) break;
  }
  return fragmentos;
}

function conPaginaFinal(
  entradas: ReadonlyArray<{ titulo: string; pagina: number; nivel: number }>,
  totalPaginas: number,
  etiquetas: Etiquetas,
): CapituloLibro[] {
  return entradas.map((e, i) => {
    // Termina donde empieza la siguiente entrada del mismo nivel o de uno más alto.
    const siguiente = entradas.slice(i + 1).find((x) => x.nivel <= e.nivel);
    const paginaFin = siguiente ? Math.max(e.pagina, siguiente.pagina - 1) : totalPaginas;
    return {
      orden: i + 1,
      nivel: e.nivel,
      titulo: e.titulo,
      paginaInicio: e.pagina,
      paginaFin,
      etiquetaPaginas: etiquetaDePaginas(e.pagina, paginaFin, etiquetas),
    };
  });
}

/** RB-37: capítulos (nivel 1) y secciones (nivel 2) del índice interno. Hacen falta al menos 2 capítulos. */
export function capitulosDesdeIndice(indice: readonly EntradaIndice[], totalPaginas: number, etiquetas?: Etiquetas): CapituloLibro[] {
  let entradas = indice
    .map((e) => ({ ...e, titulo: e.titulo.trim().replace(/\s+/g, ' ').slice(0, 200) }))
    .filter((e) => e.titulo !== '' && e.pagina >= 1 && e.pagina <= totalPaginas);

  // Un índice con una sola raíz (el título del libro) y todo debajo: los capítulos son sus hijos.
  if (entradas.filter((e) => e.nivel === 1).length === 1 && entradas.some((e) => e.nivel === 2)) {
    entradas = entradas.filter((e) => e.nivel > 1).map((e) => ({ ...e, nivel: e.nivel - 1 }));
  }
  entradas = entradas.filter((e) => e.nivel <= 2).sort((a, b) => a.pagina - b.pagina);
  if (entradas.filter((e) => e.nivel === 1).length < 2) return [];
  return conPaginaFinal(entradas, totalPaginas, etiquetas);
}

const ENCABEZADO = /^(cap[ií]tulo|unidad|tema|lecci[oó]n|m[oó]dulo|chapter)\s+(\d{1,3}|[ivxlcdm]{1,7})\b\s*[.:–—-]?\s*(.*)$/i;
const ROMANOS: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

export function numeroDe(texto: string): number {
  if (/^\d+$/.test(texto)) return Number(texto);
  const letras = texto.toLowerCase().split('').map((l) => ROMANOS[l] as number);
  return letras.reduce((suma, valor, i) => suma + (valor < (letras[i + 1] ?? 0) ? -valor : valor), 0);
}

/**
 * RB-37: respaldo sin índice interno. Un encabezado va en las primeras líneas de la página; se descartan las
 * páginas de índice (varios encabezados o puntos guía) y las cabeceras repetidas, y la numeración debe subir.
 * Solo se usa la palabra más frecuente, para no mezclar "Unidad 1" con "Tema 1". Sin 2 capítulos, nada.
 */
export function capitulosDesdeEncabezados(paginas: readonly string[], etiquetas?: Etiquetas): CapituloLibro[] {
  const hallados: Array<{ palabra: string; numero: number; titulo: string; pagina: number }> = [];
  paginas.forEach((texto, indice) => {
    const lineas = texto.split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).filter((l) => l !== '');
    const primeras = lineas.slice(0, 3);
    const coincidencias = primeras.filter((l) => ENCABEZADO.test(l));
    if (coincidencias.length !== 1 || lineas.some((l) => /\.{3,}/.test(l))) return;
    const linea = coincidencias[0] as string;
    const m = ENCABEZADO.exec(linea) as RegExpExecArray;
    const posicion = lineas.indexOf(linea);
    const siguiente = lineas[posicion + 1];
    const resto = (m[3] as string).trim() || (siguiente && siguiente.length <= 120 && !/^\d+$/.test(siguiente) ? siguiente : '');
    const encabezado = `${(m[1] as string).charAt(0).toUpperCase()}${(m[1] as string).slice(1).toLowerCase()} ${m[2]}`;
    hallados.push({
      palabra: (m[1] as string).toLowerCase(),
      numero: numeroDe(m[2] as string),
      titulo: (resto ? `${encabezado}: ${resto}` : encabezado).slice(0, 200),
      pagina: indice + 1,
    });
  });

  const cuentas = new Map<string, number>();
  for (const h of hallados) cuentas.set(h.palabra, (cuentas.get(h.palabra) ?? 0) + 1);
  const palabra = [...cuentas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const elegidos: typeof hallados = [];
  for (const h of hallados) {
    if (h.palabra === palabra && h.numero > (elegidos.at(-1)?.numero ?? 0)) elegidos.push(h);
  }
  if (elegidos.length < 2) return [];
  return conPaginaFinal(elegidos.map((e) => ({ titulo: e.titulo, pagina: e.pagina, nivel: 1 })), paginas.length, etiquetas);
}

/** RB-37: primero el índice interno; si no sirve, los encabezados. */
export function detectarCapitulos(paginas: readonly string[], indice: readonly EntradaIndice[], etiquetas?: Etiquetas): CapituloLibro[] {
  const delIndice = capitulosDesdeIndice(indice, paginas.length, etiquetas);
  return delIndice.length > 0 ? delIndice : capitulosDesdeEncabezados(paginas, etiquetas);
}
