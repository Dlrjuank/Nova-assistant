import { extractText, getDocumentProxy } from 'unpdf';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

/** Devuelve el texto plano del PDF. No valida tamaño ni vacío (lo hacen las reglas). */
export async function extraerTexto(contenido: ArrayBuffer | Uint8Array): Promise<string> {
  try {
    const bytes = contenido instanceof Uint8Array ? contenido : new Uint8Array(contenido);
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (error) {
    console.error('No se pudo leer el PDF:', error);
    throw new ErrorDeNegocio('PDF_INVALIDO');
  }
}
