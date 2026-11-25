// @vitest-environment node
// E20b: al nombrar una tarea, el Asistente escribe una frase natural con la fecha en palabras una sola vez; nunca la
// línea interna del contexto. Respuestas simuladas: sin llamadas reales a Gemini.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  existenDocumentos: vi.fn(),
  recuperarFragmentos: vi.fn(),
  tareasPendientesComoTexto: vi.fn(),
  generarEmbedding: vi.fn(),
  responder: vi.fn(),
}));
vi.mock('@/lib/datos/documentos', () => ({ existenDocumentos: m.existenDocumentos }));
vi.mock('@/lib/datos/fragmentos', () => ({ recuperarFragmentos: m.recuperarFragmentos }));
vi.mock('@/lib/datos/tareas', () => ({ tareasPendientesComoTexto: m.tareasPendientesComoTexto }));
vi.mock('@/lib/llm/gemini', () => ({ llm: { generarEmbedding: m.generarEmbedding, responder: m.responder } }));

import { consultar } from '@/lib/datos/consulta';
import { SYSTEM_PROMPT } from '@/lib/llm/prompts';
import { fechasNaturales } from '@/lib/reglas/asistente';
import { fechaEnPalabras } from '@/lib/reglas/fechas';

const U = '33333333-3333-4333-8333-333333333333';
const HOY = '2026-11-24';
const TAREA = { id: '397a5717-aaaa-4bbb-8ccc-dddddddddddd', titulo: 'Tarea', texto: 'Título: Tarea\nVence: sábado 28 de noviembre (2026-11-28)\nPrioridad: media\nCategoría: General' };
/** Ninguna fecha numérica (ni AAAA-MM-DD ni DD/MM/AAAA) en la respuesta. */
const FECHA_NUMERICA = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${HOY}T15:00:00Z`));
  m.existenDocumentos.mockResolvedValue(false);
  m.tareasPendientesComoTexto.mockResolvedValue([TAREA]);
});
afterEach(() => vi.useRealTimers());

describe('respuestas sobre tareas', () => {
  it('el caso reportado: la línea del contexto copiada pasa a una frase natural con la fecha una vez', async () => {
    m.responder.mockResolvedValue('Esta semana tienes:\n- Tarea (categoría: General; prioridad: Media; fecha límite: 28/11/2026, 2026-11-28)');
    const r = await consultar(U, '¿Qué tengo esta semana?');
    expect(r.respuesta).toBe('Esta semana tienes:\n- Tarea: vence el sábado 28 de noviembre (prioridad media)');
    expect(r.respuesta).not.toMatch(FECHA_NUMERICA);
  });

  it('con horario, y la forma nueva del contexto copiada ("Vence: … (AAAA-MM-DD)")', () => {
    expect(fechasNaturales('Clase (categoría: Cálculo; prioridad: Alta; fecha límite: 28/11/2026, 2026-11-28; horario: 15:00 – 16:30)', HOY)).toBe(
      'Clase: vence el sábado 28 de noviembre (prioridad alta, 15:00 – 16:30)',
    );
    expect(fechasNaturales('Tarea. Vence: sábado 28 de noviembre (2026-11-28)', HOY)).toBe('Tarea. Vence: sábado 28 de noviembre');
  });

  it('fechas sueltas en números pasan a palabras; de otro año, con el año', () => {
    expect(fechasNaturales('Entrega el 2026-11-28 y el 28/11/2026 (2026-11-28).', HOY)).toBe('Entrega el sábado 28 de noviembre y el sábado 28 de noviembre.');
    expect(fechasNaturales('Vence el 2027-01-04.', HOY)).toBe('Vence el lunes 4 de enero de 2027.');
    expect(fechasNaturales('Sin fechas aquí.', HOY)).toBe('Sin fechas aquí.');
    expect(fechaEnPalabras('2026-02-30', HOY)).toBe('2026-02-30'); // inválida: igual
  });

  it('una respuesta solo de documentos conserva sus fechas (no había tareas en el contexto)', async () => {
    m.existenDocumentos.mockResolvedValue(true);
    m.generarEmbedding.mockResolvedValue([0.1]);
    m.recuperarFragmentos.mockResolvedValue([{ id: 1, documento_id: 'd', nombre_archivo: 'Historia.pdf', numero: 1, contenido: 'x', etiqueta_paginas: '3' }]);
    m.responder.mockResolvedValue('La constitución se firmó el 1991-07-04 [Historia.pdf · p. 3].');
    const r = await consultar(U, '¿Cuándo se firmó la constitución?');
    expect(r.respuesta).toContain('1991-07-04');
  });

  it('el prompt pide la frase natural y el contexto trae la fecha en palabras una sola vez', async () => {
    m.responder.mockResolvedValue('Tarea: vence el sábado 28 de noviembre (prioridad media).');
    await consultar(U, '¿Qué tengo esta semana?');
    const { sistema, contexto } = m.responder.mock.calls[0]?.[0] as { sistema: string; contexto: string };
    expect(sistema).toBe(SYSTEM_PROMPT);
    expect(sistema).toContain('No copies las líneas del contexto');
    expect(contexto).toContain('Vence: sábado 28 de noviembre (2026-11-28)');
    expect(contexto).not.toContain('28/11/2026');
  });
});
