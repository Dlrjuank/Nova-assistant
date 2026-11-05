// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fragmentar } from '@/lib/reglas/fragmentacion';
import { palabras } from './ayudas';

const contar = (t: string) => t.split(' ').length;

describe('fragmentacion', () => {
  it('T-21 1200 palabras → 3 fragmentos (500, 500, 300) numerados desde 1', () => {
    const f = fragmentar(palabras(1200));
    expect(f).toHaveLength(3);
    expect(f.map((x) => x.numero)).toEqual([1, 2, 3]);
    expect(f.map((x) => contar(x.contenido))).toEqual([500, 500, 300]);
  });
  it('T-22 300 palabras → 1 fragmento', () => {
    expect(fragmentar(palabras(300))).toHaveLength(1);
  });
  it('T-23 el fragmento 2 empieza 50 palabras antes del fin del 1', () => {
    const [f1, f2] = fragmentar(palabras(1200));
    expect(f1!.contenido.split(' ').slice(-50)).toEqual(f2!.contenido.split(' ').slice(0, 50));
    expect(f2!.contenido.startsWith('p451 ')).toBe(true);
  });
  it('texto vacío → sin fragmentos; 500 exactas → 1', () => {
    expect(fragmentar('  \n ')).toEqual([]);
    expect(fragmentar(palabras(500))).toHaveLength(1);
  });
});
