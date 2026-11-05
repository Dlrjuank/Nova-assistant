// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MENSAJES } from '@/lib/reglas/errores';
import { contarPalabrasYCaracteres, mencionaTareas, validarConsulta } from '@/lib/reglas/consulta';
import { esperarCodigo } from './ayudas';

describe('consulta', () => {
  it('T-03 "Mi agenda" pasa (2 palabras, 9 caracteres)', () => {
    expect(() => validarConsulta('Mi agenda')).not.toThrow();
  });
  it('T-04 "Agenda" → CONSULTA_MUY_CORTA (1 palabra)', () => {
    esperarCodigo(() => validarConsulta('Agenda'), 'CONSULTA_MUY_CORTA');
    expect(MENSAJES.CONSULTA_MUY_CORTA).toBe('La instrucción es demasiado corta');
  });
  it('T-05 "Hola tú" → CONSULTA_MUY_CORTA (7 caracteres)', () => {
    esperarCodigo(() => validarConsulta('Hola tú'), 'CONSULTA_MUY_CORTA');
  });
  it('T-06 "  Mi   agenda  " se normaliza y pasa', () => {
    expect(() => validarConsulta('  Mi   agenda  ')).not.toThrow();
    expect(contarPalabrasYCaracteres('  Mi   agenda  ')).toEqual({ palabras: 2, caracteres: 9 });
  });
  it('T-07 contarPalabrasYCaracteres("Hola tú") → 2 y 7', () => {
    expect(contarPalabrasYCaracteres('Hola tú')).toEqual({ palabras: 2, caracteres: 7 });
  });
  it('T-19 "¿Qué tareas tengo pendientes?" menciona tareas', () => {
    expect(mencionaTareas('¿Qué tareas tengo pendientes?')).toBe(true);
  });
  it('T-20 "¿Qué dice la factura de la luz?" no menciona tareas', () => {
    expect(mencionaTareas('¿Qué dice la factura de la luz?')).toBe(false);
  });
});
