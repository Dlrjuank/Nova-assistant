// E16 (PLAN_AMPLIACION 7.9, RB-18, B-34): "¿Es alcanzable?" para metas de la materia y de un corte.
import { describe, expect, it } from 'vitest';
import { alcanzable, calcularCorte, calcularMateria, type CorteEntrada } from '@/lib/reglas/notas';

const k = (porcentaje: number, notas: Array<number | null>) => ({ nombre: `k${porcentaje}`, porcentaje, notas });

// El ejemplo de 7.4: actual 3,7, asegurado 2,5, falta 32 %; con 7.5: 1,4 para 3,0, 4,5 para 4,0 y máximo 4,1.
const EJEMPLO: CorteEntrada = { nombre: 'Corte único', porcentaje: 10000, componentes: [k(4000, [350]), k(2000, [400, 440]), k(2000, [300, 500, null, null, null]), k(2000, [])] };
const materia = calcularMateria({ usaCortes: false, cortes: [EJEMPLO] });

describe('7.9: ¿Es alcanzable?', () => {
  it('alcanzable con la nota que hace falta (B-34)', () => {
    expect(alcanzable(materia, 400, 'truncar')).toEqual({ tipo: 'alcanzable', texto: 'Alcanzable: necesitas 4,5 en lo que falta.' });
    expect(alcanzable(materia, 300, 'truncar').texto).toBe('Alcanzable: necesitas 1,4 en lo que falta.');
  });

  it('no alcanzable con el máximo posible; ya asegurada', () => {
    expect(alcanzable(materia, 450, 'truncar')).toEqual({ tipo: 'no-alcanzable', texto: 'No alcanzable: lo máximo posible es 4,1.' });
    expect(alcanzable(materia, 250, 'truncar')).toEqual({ tipo: 'asegurada', texto: 'Ya la aseguraste.' });
  });

  it('con todo calificado: cumplida o no según la nota mostrada (y el redondeo)', () => {
    const final = calcularMateria({ usaCortes: false, cortes: [{ nombre: 'Corte único', porcentaje: 10000, componentes: [k(10000, [396])] }] });
    expect(alcanzable(final, 400, 'truncar')).toEqual({ tipo: 'no-cumplida', texto: 'No alcanzaste la meta: tu nota es 3,9.' });
    expect(alcanzable(final, 400, 'redondear')).toEqual({ tipo: 'cumplida', texto: 'Cumpliste la meta: tu nota es 4,0.' });
  });

  it('meta de corte: usa el peso pendiente del corte, no el de la materia', () => {
    // Corte con Parcial 50 % = 3,0 y Taller 50 % sin nota: para 4,0 en el corte hacen falta 5,0 en el taller.
    const corte = calcularCorte({ nombre: 'Corte 1', porcentaje: 3000, componentes: [k(5000, [300]), k(5000, [null])] });
    expect(alcanzable(corte, 400, 'truncar').texto).toBe('Alcanzable: necesitas 5,0 en lo que falta.');
    expect(alcanzable(corte, 410, 'truncar').texto).toBe('No alcanzable: lo máximo posible es 4,0.');
  });

  it('porcentajes que no suman 100 %: no se puede decir', () => {
    const incompleta = calcularMateria({ usaCortes: false, cortes: [{ nombre: 'Corte único', porcentaje: 10000, componentes: [k(9000, [300])] }] });
    expect(alcanzable(incompleta, 300, 'truncar')).toEqual({ tipo: 'sin-sumas', texto: 'Para saber si es alcanzable, los porcentajes deben sumar 100 %.' });
  });
});
