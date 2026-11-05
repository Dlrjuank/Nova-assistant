import { PDF_MAX_BYTES } from '@/lib/config/nova';
import { ErrorDeNegocio } from './errores';

/** RN-01: el límite es inclusive. */
export function validarTamanoPdf(bytes: number): void {
  if (bytes > PDF_MAX_BYTES) throw new ErrorDeNegocio('ARCHIVO_MUY_GRANDE');
}

/** RN-09: sin texto seleccionable no hay OCR. */
export function validarTextoExtraido(texto: string): void {
  if (texto.trim() === '') throw new ErrorDeNegocio('PDF_SIN_TEXTO');
}
