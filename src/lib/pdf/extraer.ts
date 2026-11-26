import { extractText, getDocumentProxy, inspectPages } from 'unpdf';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import type { EntradaIndice } from '@/lib/reglas/libros';
import { paginasSinTexto } from '@/lib/reglas/ocr';

export interface PdfExtraido {
  /** El texto de cada página, en orden. */
  paginas: string[];
  /** El número impreso de cada página, si el PDF lo define. */
  etiquetas: string[] | null;
  indice: EntradaIndice[];
  /**
   * E20d-3: las páginas (desde 1) sin texto que muestran una imagen grande: las escaneadas. Una página en blanco o
   * con un adorno no cuenta, así un libro con páginas en blanco no pregunta por el OCR.
   */
  escaneadas: number[];
}

/** Una página escaneada: la imagen cubre al menos esto de la página. */
const COBERTURA_ESCANEADA = 0.3;

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

/** E20d-3: de las páginas sin texto, las que pintan una imagen grande. Si no se puede medir, todas las sin texto. */
async function paginasEscaneadas(pdf: Documento, paginas: readonly string[]): Promise<number[]> {
  const sinTexto = paginasSinTexto(paginas);
  if (sinTexto.length === 0) return [];
  try {
    const { pages } = await inspectPages(pdf);
    return sinTexto.filter((p) => {
      const medida = pages[p - 1];
      return medida !== undefined && medida.imageCount > 0 && medida.imageCoverage >= COBERTURA_ESCANEADA;
    });
  } catch (error) {
    console.error('No se pudieron medir las imágenes del PDF:', error);
    return sinTexto;
  }
}

/** E10b: texto por página, números impresos e índice interno. No valida tamaño ni vacío (lo hacen las reglas). */
export async function extraerPdf(contenido: ArrayBuffer | Uint8Array): Promise<PdfExtraido> {
  try {
    const bytes = contenido instanceof Uint8Array ? contenido : new Uint8Array(contenido);
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: false });
    const [etiquetas, indice, escaneadas] = await Promise.all([
      pdf.getPageLabels().catch(() => null),
      leerIndice(pdf).catch(() => []),
      paginasEscaneadas(pdf, text),
    ]);
    return { paginas: text, etiquetas, indice, escaneadas };
  } catch (error) {
    console.error('No se pudo leer el PDF:', error);
    throw new ErrorDeNegocio('PDF_INVALIDO');
  }
}
