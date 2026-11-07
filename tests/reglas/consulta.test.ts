// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MENSAJES } from '@/lib/reglas/errores';
import {
  AVISO_SIN_FUENTES,
  AVISO_SOLO_TAREAS,
  avisoAsistente,
  contarPalabrasYCaracteres,
  mencionaTareas,
  validarConsulta,
} from '@/lib/reglas/consulta';
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

describe('RB-30: aviso de la pantalla del Asistente', () => {
  it('con documentos no hay aviso, haya o no tareas', () => {
    expect(avisoAsistente(true, true)).toBeNull();
    expect(avisoAsistente(true, false)).toBeNull();
  });
  it('sin documentos y con tareas pendientes: aviso informativo con el texto aprobado', () => {
    expect(avisoAsistente(false, true)).toBe('solo-tareas');
    expect(AVISO_SOLO_TAREAS).toBe(
      'Aún no hay documentos indexados: por ahora el asistente responde solo sobre tus tareas pendientes.',
    );
  });
  it('sin documentos ni tareas pendientes: aviso informativo que no bloquea (RB-32), en tuteo', () => {
    expect(avisoAsistente(false, false)).toBe('sin-fuentes');
    expect(AVISO_SIN_FUENTES).toContain('Puedes preguntar igual');
    expect(AVISO_SIN_FUENTES).toContain('indexa un PDF');
    expect(AVISO_SIN_FUENTES).not.toMatch(/Indexe|antes de preguntar/);
  });
});

describe('RB-31: palabras de fechas llevan las tareas al contexto', () => {
  it('semana, mañana, hoy y vencidas cuentan como preguntas de tareas', () => {
    for (const q of ['¿Qué tengo para hacer esta semana?', '¿Qué tengo para mañana?', 'que hay para manana', '¿Qué hay para hoy?', '¿Tengo algo vencido o vencidas?', '¿Qué vence primero?']) {
      expect(mencionaTareas(q)).toBe(true);
    }
  });
  it('"¿cuál es el primer paso?" no es una pregunta de tareas', () => {
    expect(mencionaTareas('¿Cuál es el primer paso del manual?')).toBe(false);
  });
});
