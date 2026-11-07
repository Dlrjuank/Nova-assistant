import {
  CONSULTA_MIN_CARACTERES,
  CONSULTA_MIN_PALABRAS,
  NIVELES_PALABRAS_CLAVE_TAREAS,
} from '@/lib/config/nova';
import { ErrorDeNegocio } from './errores';

export function normalizarConsulta(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}

export function contarPalabrasYCaracteres(texto: string): { palabras: number; caracteres: number } {
  const normal = normalizarConsulta(texto);
  return { palabras: normal === '' ? 0 : normal.split(' ').length, caracteres: normal.length };
}

/** RN-02: al menos 2 palabras y al menos 8 caracteres, ambas condiciones. */
export function esConsultaValida(texto: string): boolean {
  const { palabras, caracteres } = contarPalabrasYCaracteres(texto);
  return palabras >= CONSULTA_MIN_PALABRAS && caracteres >= CONSULTA_MIN_CARACTERES;
}

export function validarConsulta(texto: string): void {
  if (!esConsultaValida(texto)) throw new ErrorDeNegocio('CONSULTA_MUY_CORTA');
}

/**
 * RN-21: una pregunta de seguimiento como "¿y el segundo?" no dice de qué habla, así que la búsqueda en
 * los documentos (y RN-12) usa la pregunta anterior del usuario junto con la nueva.
 */
export function textoDeBusqueda(pregunta: string, preguntaAnterior?: string | undefined): string {
  const nueva = normalizarConsulta(pregunta);
  return preguntaAnterior ? `${normalizarConsulta(preguntaAnterior)}\n${nueva}` : nueva;
}

/** RN-12: la pregunta pide tareas si contiene alguna palabra clave. */
/** RB-30: aviso informativo del Asistente cuando no hay documentos pero sí tareas pendientes. */
export const AVISO_SOLO_TAREAS = 'Aún no hay documentos indexados: por ahora el asistente responde solo sobre tus tareas pendientes.';

/** RB-32: sin documentos ni tareas pendientes. Informa, no bloquea: se puede preguntar igual. */
export const AVISO_SIN_FUENTES =
  'Aún no tienes documentos indexados ni tareas pendientes. Puedes preguntar igual; para que el asistente responda sobre tus documentos, indexa un PDF.';

/**
 * RB-30 y RB-32: qué aviso informativo muestra la pantalla del Asistente (ninguno bloquea la pregunta).
 * 'sin-fuentes' = AVISO_SIN_FUENTES; 'solo-tareas' = AVISO_SOLO_TAREAS; null = ninguno.
 */
export function avisoAsistente(hayDocumentos: boolean, hayTareasPendientes: boolean): 'sin-fuentes' | 'solo-tareas' | null {
  if (hayDocumentos) return null;
  return hayTareasPendientes ? 'solo-tareas' : 'sin-fuentes';
}

export function mencionaTareas(texto: string): boolean {
  const minusculas = texto.toLowerCase();
  return NIVELES_PALABRAS_CLAVE_TAREAS.some((clave) => minusculas.includes(clave));
}
