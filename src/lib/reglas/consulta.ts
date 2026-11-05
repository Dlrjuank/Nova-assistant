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
export function validarConsulta(texto: string): void {
  const { palabras, caracteres } = contarPalabrasYCaracteres(texto);
  if (palabras < CONSULTA_MIN_PALABRAS || caracteres < CONSULTA_MIN_CARACTERES) {
    throw new ErrorDeNegocio('CONSULTA_MUY_CORTA');
  }
}

/** RN-12: la pregunta pide tareas si contiene alguna palabra clave. */
export function mencionaTareas(texto: string): boolean {
  const minusculas = texto.toLowerCase();
  return NIVELES_PALABRAS_CLAVE_TAREAS.some((clave) => minusculas.includes(clave));
}
