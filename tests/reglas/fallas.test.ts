// E14 (PLAN_AMPLIACION 7.7, RB-14, RB-15): S-22 a S-24.
import { describe, expect, it } from 'vitest';
import { estadoConFallas, estadoFallas, textoFallas, validarFallas, validarLimiteFallas } from '@/lib/reglas/notas';

const texto = (limite: number | null, registradas: number) => textoFallas(estadoFallas(limite, registradas), limite, registradas);

describe('S-22 a S-24: fallas (7.7)', () => {
  it('S-22: a 2 y a 1 del límite, la alerta RB-14 (B-32)', () => {
    expect(estadoFallas(5, 3)).toEqual({ tipo: 'alerta', faltan: 2 });
    expect(texto(5, 3)).toBe('Te quedan 2 fallas antes de perder la materia.');
    expect(texto(5, 4)).toBe('Te queda 1 falla antes de perder la materia.');
    expect(texto(5, 2)).toBeNull(); // faltan 3: sin alerta
    expect(estadoFallas(5, 2)).toEqual({ tipo: 'bien', faltan: 3 });
  });

  it('S-23: en el límite o por encima, perdida (B-32)', () => {
    expect(estadoFallas(5, 5)).toEqual({ tipo: 'perdida' });
    expect(texto(5, 5)).toBe('Perdiste la materia por fallas (5 de 5).');
    expect(texto(5, 7)).toBe('Perdiste la materia por fallas (7 de 5).');
    expect(texto(0, 0)).toBe('Perdiste la materia por fallas (0 de 0).');
  });

  it('S-24: sin límite registrado no se calcula', () => {
    expect(estadoFallas(null, 9)).toEqual({ tipo: 'sin-limite' });
    expect(texto(null, 9)).toBeNull();
  });

  it('perdida por fallas está "En riesgo" aunque sus notas aprueben; lo que ya no alcanza se conserva', () => {
    const perdida = estadoFallas(3, 3);
    expect(estadoConFallas('Aprueba', perdida)).toBe('En riesgo');
    expect(estadoConFallas('Aprobada', perdida)).toBe('En riesgo');
    expect(estadoConFallas(null, perdida)).toBe('En riesgo');
    expect(estadoConFallas('No alcanza', perdida)).toBe('No alcanza');
    expect(estadoConFallas('Reprobada', perdida)).toBe('Reprobada');
    expect(estadoConFallas('Aprueba', estadoFallas(3, 2))).toBe('Aprueba'); // la alerta no cambia el estado
    expect(estadoConFallas(null, estadoFallas(null, 4))).toBeNull();
  });

  it('RB-15: enteros mayores o iguales a 0; el límite vacío es "sin límite"', () => {
    expect(validarFallas('0')).toBe(0);
    expect(validarFallas(' 12 ')).toBe(12);
    for (const malo of ['-1', '2,5', 'tres', '', -3, 1.5]) expect(() => validarFallas(malo)).toThrow('Las fallas deben ser un número entero mayor o igual a 0.');
    expect(validarLimiteFallas('')).toBeNull();
    expect(validarLimiteFallas(null)).toBeNull();
    expect(validarLimiteFallas('6')).toBe(6);
    expect(() => validarLimiteFallas('-2')).toThrow('Las fallas deben ser un número entero mayor o igual a 0.');
  });
});
