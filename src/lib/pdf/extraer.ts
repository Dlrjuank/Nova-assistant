import { extractText, getDocumentProxy } from 'unpdf';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import type { EntradaIndice } from '@/lib/reglas/libros';

export interface PdfExtraido {
  /** El texto de cada página, en orden. */
  paginas: string[];
  /** El número impreso de cada página, si el PDF lo define. */
  etiquetas: string[] | null;
  indice: EntradaIndice[];
}

type Documento = Awaited<ReturnType<typeof getDocumentProxy>>;
interface ItemIndice {
  title: string;
  dest: string | unknown[] | null;
  items: ItemIndice[];
}

/** Hasta 3 niveles: el primero puede ser solo el título del libro. Un destino que no se resuelve se omite. */
async function leerIndice(pdf: Documento): Promise<EntradaIndice[]> {
  const entradas: EntradaIndice[] = [];
  async function recorrer(items: ItemIndice[], nivel: number): Promise<void> {
    for (const item of items) {
      try {
        const destino = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
        const referencia = destino?.[0] as Parameters<Documento['getPageIndex']>[0] | number | undefined;
        if (referencia !== undefined && referencia !== null) {
          const indice = typeof referencia === 'number' ? referencia : await pdf.getPageIndex(referencia);
          entradas.push({ titulo: item.title, pagina: indice + 1, nivel });
        }
      } catch {
        // Un enlace roto del índice no debe impedir indexar el libro.
      }
      if (nivel < 3 && item.items?.length) await recorrer(item.items, nivel + 1);
    }
  }
  const indice = (await pdf.getOutline()) as ItemIndice[] | null;
  if (indice) await recorrer(indice, 1);
  return entradas;
}

/** E10b: texto por página, números impresos e índice interno. No valida tamaño ni vacío (lo hacen las reglas). */
export async function extraerPdf(contenido: ArrayBuffer | Uint8Array): Promise<PdfExtraido> {
  try {
    const bytes = contenido instanceof Uint8Array ? contenido : new Uint8Array(contenido);
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: false });
    const [etiquetas, indice] = await Promise.all([pdf.getPageLabels().catch(() => null), leerIndice(pdf).catch(() => [])]);
    return { paginas: text, etiquetas, indice };
  } catch (error) {
    console.error('No se pudo leer el PDF:', error);
    throw new ErrorDeNegocio('PDF_INVALIDO');
  }
}
