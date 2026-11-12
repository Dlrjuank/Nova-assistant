// S-40 y S-41 (E10d, RB-42): reparto de capítulos entre dos fechas y por semana.
import { describe, expect, it } from 'vitest';
import { numerarCapitulos, numeroEnTitulo, repartirFechas, tituloTareaCapitulo } from '@/lib/reglas/planLectura';

describe('S-40: entre dos fechas', () => {
  it('4 capítulos en dos semanas: tramos iguales y el último vence el día final (B-54)', () => {
    expect(repartirFechas(4, { modo: 'fechas', inicio: '2026-11-16', fin: '2026-11-29' })).toEqual(['2026-11-19', '2026-11-22', '2026-11-26', '2026-11-29']);
  });

  it('un solo capítulo vence el día final', () => {
    expect(repartirFechas(1, { modo: 'fechas', inicio: '2026-11-16', fin: '2026-11-20' })).toEqual(['2026-11-20']);
  });

  it('con más capítulos que días, varios comparten día y siguen en orden', () => {
    const fechas = repartirFechas(5, { modo: 'fechas', inicio: '2026-11-16', fin: '2026-11-17' });
    expect(fechas).toEqual(['2026-11-16', '2026-11-16', '2026-11-17', '2026-11-17', '2026-11-17']);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it('la misma fecha de inicio y final es válida', () => {
    expect(repartirFechas(2, { modo: 'fechas', inicio: '2026-11-16', fin: '2026-11-16' })).toEqual(['2026-11-16', '2026-11-16']);
  });

  it('cruza meses y años con aritmética de calendario', () => {
    expect(repartirFechas(2, { modo: 'fechas', inicio: '2026-12-30', fin: '2027-01-02' })).toEqual(['2026-12-31', '2027-01-02']);
  });

  it('la fecha final antes de la de inicio da el mensaje exacto', () => {
    expect(() => repartirFechas(2, { modo: 'fechas', inicio: '2026-11-20', fin: '2026-11-19' })).toThrow('La fecha final debe ser igual o posterior a la de inicio.');
  });

  it('una fecha que no existe se rechaza', () => {
    expect(() => repartirFechas(1, { modo: 'fechas', inicio: '2026-02-30', fin: '2026-03-10' })).toThrow(expect.objectContaining({ codigo: 'FECHA_INVALIDA' }));
  });
});

describe('S-41: por semana', () => {
  it('2 por semana: cada semana reparte sus capítulos en sus 7 días', () => {
    expect(repartirFechas(5, { modo: 'semana', inicio: '2026-11-16', porSemana: 2 })).toEqual([
      '2026-11-19',
      '2026-11-22',
      '2026-11-26',
      '2026-11-29',
      '2026-12-06',
    ]);
  });

  it('1 por semana: uno al final de cada semana', () => {
    expect(repartirFechas(3, { modo: 'semana', inicio: '2026-11-16', porSemana: 1 })).toEqual(['2026-11-22', '2026-11-29', '2026-12-06']);
  });

  it('fuera de 1 a 20 por semana se rechaza', () => {
    for (const porSemana of [0, 21, 1.5]) expect(() => repartirFechas(1, { modo: 'semana', inicio: '2026-11-16', porSemana })).toThrow();
  });

  it('sin capítulos pendientes no hay fechas, pero las fechas se validan igual', () => {
    expect(repartirFechas(0, { modo: 'semana', inicio: '2026-11-16', porSemana: 2 })).toEqual([]);
    expect(() => repartirFechas(0, { modo: 'fechas', inicio: '2026-11-20', fin: '2026-11-01' })).toThrow();
  });
});

describe('título de la tarea', () => {
  it('"Leer cap. N: Título (pp. a–b)", sin repetir "Capítulo N"', () => {
    expect(tituloTareaCapitulo(3, 'Capítulo 3. Los ecosistemas', '45–67')).toBe('Leer cap. 3: Los ecosistemas (pp. 45–67)');
    expect(tituloTareaCapitulo(1, 'Introducción', '9')).toBe('Leer cap. 1: Introducción (p. 9)');
  });

  it('no pasa de 200 caracteres', () => {
    const t = tituloTareaCapitulo(12, 'x'.repeat(400), '100–140');
    expect(t).toHaveLength(200);
    expect(t.endsWith('… (pp. 100–140)')).toBe(true);
  });

  it('el número sale del título si lo trae; si no, de su posición entre los de nivel 1', () => {
    expect(numeroEnTitulo('CAPÍTULO 7: La célula')).toBe(7);
    expect(numeroEnTitulo('La célula')).toBeNull();
    const numeros = numerarCapitulos([
      { orden: 0, nivel: 1, titulo: 'Introducción' },
      { orden: 1, nivel: 1, titulo: 'Capítulo 1. Energía' },
      { orden: 2, nivel: 2, titulo: '1.1 Calor' },
      { orden: 3, nivel: 1, titulo: 'Los ecosistemas' },
    ]);
    expect([...numeros]).toEqual([
      [0, 1],
      [1, 1],
      [3, 3],
    ]);
  });
});
