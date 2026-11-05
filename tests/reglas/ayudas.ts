import { expect } from 'vitest';
import { ErrorDeNegocio, type CodigoError } from '@/lib/reglas/errores';

/** Comprueba que fn lanza un ErrorDeNegocio con el código dado. */
export function esperarCodigo(fn: () => unknown, codigo: CodigoError): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ErrorDeNegocio);
    expect((error as ErrorDeNegocio).codigo).toBe(codigo);
    return;
  }
  throw new Error(`Se esperaba el error ${codigo} y no se lanzó ninguno`);
}

export function palabras(n: number): string {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`).join(' ');
}
