import type { ResultadoProductividad } from './tipos';

export async function calcularProductividad(): Promise<ResultadoProductividad | { sinTareas: true }> {
  throw new Error('calcularProductividad se implementa en P10.');
}
