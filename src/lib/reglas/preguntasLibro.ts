import { numeroDe, type CapituloLibro } from './libros';

/** E10c (PLAN_AMPLIACION 5.9, RB-39 a RB-41): reconocer preguntas por página o capítulo. Funciones puras. */

export const MENSAJE_ELEGIR_DOCUMENTO = '¿En qué documento? Elígelo en "Buscar en".';
export const FRAGMENTOS_POR_PARTE = 60; // unas 30.000 palabras por respuesta (RB-40)
export const TEXTO_CONTINUAR = 'sigue con el resto';

export const MODOS_EXPLICAR = [
  { id: 'simple', texto: 'Más simple', instruccion: 'con palabras más simples, como para alguien que apenas empieza con el tema' },
  { id: 'ejemplo', texto: 'Con un ejemplo', instruccion: 'con un ejemplo concreto que ayude a entenderla' },
  { id: 'pasos', texto: 'Paso a paso', instruccion: 'paso a paso, en una lista numerada' },
  { id: 'corto', texto: 'Resumen corto', instruccion: 'en un resumen de máximo tres frases' },
  { id: 'analogia', texto: 'Con una analogía', instruccion: 'con una analogía de la vida diaria' },
] as const;
export type ModoExplicar = (typeof MODOS_EXPLICAR)[number]['id'];

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** RB-39: "página 45", "pág. 45", "p. 45". "3 páginas" no es una pregunta por página. */
export function detectarPagina(texto: string): number | null {
  const m = /(?:^|[\s¿(])(?:p[aá]gina|p[aá]g\.?|p\.)\s*(?:n[uú]mero\s+)?(\d{1,4})(?!\d)/i.exec(texto);
  return m ? Number(m[1]) : null;
}

export type PedidoCapitulo = { tipo: 'numero'; numero: number } | { tipo: 'titulo'; titulo: string };

/** RB-40: "capítulo 3", "capítulo IV", "unidad 2" o "capítulo de la fotosíntesis". "El capítulo anterior" no cuenta. */
export function detectarCapitulo(texto: string): PedidoCapitulo | null {
  const numero = /\b(?:cap[ií]tulo|unidad|lecci[oó]n|chapter)\s+(?:n[uú]mero\s+)?(\d{1,3}|[ivxl]{1,6})(?![\p{L}\d])/iu.exec(texto);
  if (numero) return { tipo: 'numero', numero: numeroDe(numero[1] as string) };
  const titulo = /\bcap[ií]tulo\s+(?:de|sobre|acerca\s+de|llamado|titulado)\s+(?:(?:la|el|los|las)\s+)?(.{3,80}?)[\s?.!]*$/iu.exec(texto);
  return titulo ? { tipo: 'titulo', titulo: (titulo[1] as string).trim() } : null;
}

/** RB-40: "sigue", "continúa" (también "sigue con el resto"), solo vale justo después de un capítulo por partes. */
export function esContinuacion(texto: string): boolean {
  return /^(?:sigue|contin[uú]a)\b/i.test(texto.trim());
}

/** Si la etiqueta de páginas ("45" o "44–46") incluye la página pedida. Con números romanos solo se compara el lado numérico. */
export function etiquetaIncluye(etiqueta: string, pagina: number): boolean {
  const [inicio, fin] = etiqueta.split('–') as [string, string | undefined];
  const a = /^\d+$/.test(inicio) ? Number(inicio) : null;
  if (fin === undefined) return a === pagina;
  const b = /^\d+$/.test(fin) ? Number(fin) : null;
  if (a !== null && b !== null) return a <= pagina && pagina <= b;
  return a === pagina || b === pagina;
}

/** RB-39: la página del PDF de una página impresa, a partir de un fragmento que la incluye. */
export function paginaDelPdf(f: { etiqueta_paginas?: string | null; pagina_inicio: number | null; pagina_fin: number | null }, pagina: number): number | null {
  const [inicio, fin] = (f.etiqueta_paginas ?? '').split('–') as [string, string | undefined];
  if (/^\d+$/.test(inicio) && f.pagina_inicio !== null) return f.pagina_inicio + (pagina - Number(inicio));
  if (fin !== undefined && /^\d+$/.test(fin) && f.pagina_fin !== null) return f.pagina_fin - (Number(fin) - pagina);
  return null;
}

/** RB-39: documentos indexados antes de guardar dónde empieza cada página. */
export const AVISO_PAGINA_APROXIMADA = 'Este documento se indexó antes de este ajuste: la respuesta puede incluir texto de páginas vecinas. Vuelve a indexarlo para que sea solo de esta página.';

const CAPITULO_NUMERADO = /^(?:(?:cap[ií]tulo|unidad|tema|lecci[oó]n|m[oó]dulo|chapter)\s+)?(\d{1,3}|[ivxlcdm]{1,7})(?![\p{L}\d])/iu;

/** RB-40: el capítulo pedido. Por número: el que lo diga en su título; si ninguno, el N-ésimo. Por título: capítulos antes que secciones. */
export function buscarCapitulo<T extends Pick<CapituloLibro, 'nivel' | 'titulo'>>(capitulos: readonly T[], pedido: PedidoCapitulo): T | null {
  const principales = capitulos.filter((c) => c.nivel === 1);
  if (pedido.tipo === 'numero') {
    const conNumero = principales.find((c) => {
      const m = CAPITULO_NUMERADO.exec(c.titulo.trim());
      return m !== null && numeroDe(m[1] as string) === pedido.numero;
    });
    return conNumero ?? principales[pedido.numero - 1] ?? null;
  }
  const buscado = sinAcentos(pedido.titulo);
  const palabras = buscado.split(/\s+/).filter((p) => p.length > 2);
  const coincide = (c: T) => {
    const titulo = sinAcentos(c.titulo);
    return titulo.includes(buscado) || (palabras.length > 0 && palabras.every((p) => titulo.includes(p)));
  };
  return principales.find(coincide) ?? capitulos.find(coincide) ?? null;
}
