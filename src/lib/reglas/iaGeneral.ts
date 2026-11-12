import { SIN_RESPUESTA, SIN_RESPUESTA_FUENTES_WEB } from '@/lib/llm/prompts';
import { BUSCAR_EN_WEB } from './fuentesWeb';

/** E10c3 (RB-59): marca exacta de toda respuesta de la IA general, también al recargar. */
export const MARCA_IA = 'Respuesta general de la IA, sin fuentes. Compruébala si es importante.';
export const BOTON_PREGUNTAR_IA = 'Preguntarle a la IA';

// La de un documento elegido en "Buscar en" (RB-39b), con cualquier nombre de archivo.
const SIN_RESPUESTA_EN_DOCUMENTO = /^No encontré esto en «.+»\. Prueba con "Todos los documentos" en "Buscar en"\.$/s;

/** RB-60: "Preguntarle a la IA" solo bajo un "No encontré": de documentos (RN-13 o el de un documento elegido) o de Fuentes web. */
export function ofrecePreguntarIa(m: { autor: string; texto: string; origen?: string | null | undefined }): boolean {
  if (m.autor !== 'asistente') return false;
  if (m.origen === BUSCAR_EN_WEB) return m.texto === SIN_RESPUESTA_FUENTES_WEB;
  return !m.origen && (m.texto === SIN_RESPUESTA || SIN_RESPUESTA_EN_DOCUMENTO.test(m.texto));
}
