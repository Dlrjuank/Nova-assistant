import { PRIORIDAD_POR_DEFECTO } from '@/lib/config/nova';
import { ErrorDeNegocio } from './errores';
import { esFechaISOValida } from './fechas';

export function normalizarTitulo(titulo: string): string {
  return titulo.trim();
}

/** RN-04: sin valor → 2; fuera de 1..3 (o no entero) → PRIORIDAD_INVALIDA. */
export function resolverPrioridad(prioridad: number | null | undefined): number {
  if (prioridad === null || prioridad === undefined) return PRIORIDAD_POR_DEFECTO;
  if (!Number.isInteger(prioridad) || prioridad < 1 || prioridad > 3) {
    throw new ErrorDeNegocio('PRIORIDAD_INVALIDA');
  }
  return prioridad;
}

/** RN-04, RN-06, RN-07. */
export function validarTarea(d: {
  titulo: string;
  fechaLimite: string;
  prioridad?: number | null | undefined;
}): { titulo: string; prioridad: number } {
  const titulo = normalizarTitulo(d.titulo);
  if (titulo.length === 0) throw new ErrorDeNegocio('DATOS_INVALIDOS');
  if (!esFechaISOValida(d.fechaLimite)) throw new ErrorDeNegocio('FECHA_INVALIDA');
  return { titulo, prioridad: resolverPrioridad(d.prioridad) };
}
