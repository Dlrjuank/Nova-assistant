// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MENSAJES } from '@/lib/reglas/errores';
import { resolverPrioridad, validarTarea } from '@/lib/reglas/tarea';
import { esperarCodigo } from './ayudas';

describe('tarea', () => {
  it('T-08 prioridad undefined → 2', () => {
    expect(resolverPrioridad(undefined)).toBe(2);
  });
  it('T-09 prioridad 0 → PRIORIDAD_INVALIDA con el mensaje exacto', () => {
    esperarCodigo(() => resolverPrioridad(0), 'PRIORIDAD_INVALIDA');
    expect(MENSAJES.PRIORIDAD_INVALIDA).toBe('La prioridad debe ser 1, 2 o 3');
  });
  it('T-10 prioridad 5 → PRIORIDAD_INVALIDA', () => {
    esperarCodigo(() => resolverPrioridad(5), 'PRIORIDAD_INVALIDA');
  });
  it('T-11 prioridades 1 y 3 se conservan', () => {
    expect(resolverPrioridad(1)).toBe(1);
    expect(resolverPrioridad(3)).toBe(3);
  });
  it('T-12 título en blanco → DATOS_INVALIDOS', () => {
    esperarCodigo(() => validarTarea({ titulo: '  ', fechaLimite: '2026-03-10' }), 'DATOS_INVALIDOS');
  });
  it('T-13 fecha 2026-02-30 → FECHA_INVALIDA', () => {
    esperarCodigo(() => validarTarea({ titulo: 'Pagar luz', fechaLimite: '2026-02-30' }), 'FECHA_INVALIDA');
  });
  it('T-14 fecha 03-10-2026 → FECHA_INVALIDA', () => {
    esperarCodigo(() => validarTarea({ titulo: 'Pagar luz', fechaLimite: '03-10-2026' }), 'FECHA_INVALIDA');
  });
  it('T-15 fecha pasada es válida; recorta título y aplica prioridad por defecto', () => {
    expect(validarTarea({ titulo: '  Pagar luz ', fechaLimite: '2020-01-01' })).toEqual({
      titulo: 'Pagar luz',
      prioridad: 2,
    });
  });
});
