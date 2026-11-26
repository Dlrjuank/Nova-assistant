import type { TipoDocumento } from './tiposDocumento';

/**
 * "Buscar en" del Asistente con muchos documentos (pedido del usuario del 2026-11-26): con más de
 * `UMBRAL_BUSCADOR` aparece un campo que filtra la lista por nombre, y los documentos van agrupados por tipo.
 * Funciones puras, compartidas con las pruebas.
 */

export const UMBRAL_BUSCADOR = 5;

export interface DocumentoBuscable {
  id: string;
  nombre: string;
  tipo?: TipoDocumento | undefined;
}

/** Sin tildes ni mayúsculas: "cálculo" encuentra "Calculo". */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Los documentos cuyo nombre tiene todas las palabras escritas, en cualquier orden. Sin texto, todos. */
export function filtrarDocumentos<T extends DocumentoBuscable>(documentos: readonly T[], texto: string): T[] {
  const palabras = normalizar(texto).split(/\s+/).filter((p) => p !== '');
  if (palabras.length === 0) return [...documentos];
  return documentos.filter((d) => {
    const nombre = normalizar(d.nombre);
    return palabras.every((p) => nombre.includes(p));
  });
}

const GRUPO_DE_TIPO: Record<TipoDocumento, string> = {
  pdf: 'PDF',
  pdf_escaneado: 'PDF',
  docx: 'Word',
  pptx: 'PowerPoint',
  imagen: 'Fotos',
  md: 'Markdown',
  txt: 'Texto',
};
const ORDEN_GRUPOS = ['PDF', 'Word', 'PowerPoint', 'Fotos', 'Markdown', 'Texto'];

/** Los documentos agrupados por tipo, en un orden fijo; dentro de cada grupo, en el orden recibido (recientes primero). */
export function agruparPorTipo<T extends DocumentoBuscable>(documentos: readonly T[]): Array<{ grupo: string; documentos: T[] }> {
  const grupos = new Map<string, T[]>();
  for (const d of documentos) {
    const grupo = GRUPO_DE_TIPO[d.tipo ?? 'pdf'] ?? 'PDF';
    grupos.set(grupo, [...(grupos.get(grupo) ?? []), d]);
  }
  return ORDEN_GRUPOS.filter((g) => grupos.has(g)).map((grupo) => ({ grupo, documentos: grupos.get(grupo) as T[] }));
}
