// @vitest-environment node
// E20b: las etiquetas internas que el modelo copia del contexto ("[Tarea 397a5717]", "T2", "F3") nunca llegan a la
// persona. Respuestas simuladas: sin llamadas reales a Gemini.
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { sinMarcasInternas } from '@/lib/reglas/asistente';
import { validarPlanGenerado } from '@/lib/reglas/planEstudio';
import { validarTemasPropuestos } from '@/lib/reglas/temas';

const U = '33333333-3333-4333-8333-333333333333';
const TAREA = { id: '397a5717-aaaa-4bbb-8ccc-dddddddddddd', titulo: 'Taller de cálculo', texto: 'Taller de cálculo (fecha límite: 2026-11-25)' };
const FRAG = { id: 1, documento_id: 'd', nombre_archivo: 'Biologia.pdf', numero: 1, contenido: 'La mitosis tiene cuatro fases.', etiqueta_paginas: '4' };
/** Ninguna marca interna de tarea, en ninguna forma. */
const SIN_MARCA = /tarea\s+[0-9a-f]{6,}|397a5717/i;

beforeEach(() => {
  vi.clearAllMocks();
  m.generarEmbedding.mockResolvedValue([0.1]);
  m.tareasPendientesComoTexto.mockResolvedValue([TAREA]);
});

describe('el Asistente no muestra la etiqueta interna de una tarea', () => {
  it.each([
    ['en minúscula', 'Tienes el Taller de cálculo para el 2026-11-25 [tarea 397a5717].'],
    ['como en el contexto', 'Tienes el Taller de cálculo para el 2026-11-25 [Tarea 397a5717].'],
    ['entre paréntesis', 'Tienes el Taller de cálculo para el 2026-11-25 (Tarea 397a5717).'],
  ])('%s: la respuesta dice solo el título y la fecha; la cita lleva el título', async (_, simulada) => {
    m.existenDocumentos.mockResolvedValue(false);
    m.responder.mockResolvedValue(simulada);
    const r = await consultar(U, '¿Qué tengo esta semana?');
    expect(r.respuesta).toBe('Tienes el Taller de cálculo para el 2026-11-25.');
    expect(r.respuesta).not.toMatch(SIN_MARCA);
    expect(r.fuentes).toEqual([{ tipo: 'tarea', etiqueta: 'Taller de cálculo' }]);
  });

  it('en una lista y junto a una cita de PDF: se quita solo la marca de la tarea', async () => {
    m.existenDocumentos.mockResolvedValue(true);
    m.recuperarFragmentos.mockResolvedValue([FRAG]);
    m.responder.mockResolvedValue('- [Tarea 397a5717] Taller de cálculo, 2026-11-25\n- La mitosis tiene cuatro fases [Biologia.pdf · p. 4; tarea 397a5717].');
    const r = await consultar(U, '¿Qué tareas tengo y qué es la mitosis?');
    expect(r.respuesta).not.toMatch(SIN_MARCA);
    expect(r.respuesta).toContain('- Taller de cálculo, 2026-11-25');
    expect(r.respuesta).toMatch(/cuatro fases \[(Biologia\.pdf · )?p\. 4\]\./);
    expect(r.fuentes.map((f) => [f.tipo, f.etiqueta])).toEqual([
      ['pdf', 'Biologia.pdf · p. 4'],
      ['tarea', 'Taller de cálculo'],
    ]);
  });

  it('sin citar la tarea, las fuentes entregadas también salen por su título', async () => {
    m.existenDocumentos.mockResolvedValue(false);
    m.responder.mockResolvedValue('Tienes el Taller de cálculo para el 2026-11-25.');
    const r = await consultar(U, '¿Qué tengo pendiente?');
    expect(JSON.stringify(r)).not.toMatch(SIN_MARCA);
  });
});

describe('las demás citas quedan igual', () => {
  it('PDF, fuentes web y corchetes que no son marcas', () => {
    const texto = 'Según [libro.pdf · p. 45] y [Fotosíntesis · Wikipedia], el valor es [x] (ver anexo).';
    expect(sinMarcasInternas(texto)).toBe(texto);
    // En el chat "T2" puede ser texto de un documento: solo se quita en temas y planes.
    expect(sinMarcasInternas('La tabla [T2] muestra')).toBe('La tabla [T2] muestra');
    expect(sinMarcasInternas('La tabla [T2] muestra', { cortas: true })).toBe('La tabla muestra');
  });
});

describe('temas y plan de estudio sin etiquetas internas', () => {
  it('un tema propuesto con "[F1]" en el nombre se guarda sin ella', () => {
    const r = validarTemasPropuestos([{ nombre: 'Derivadas [F1]', fuente: 'F1' }], new Map([['F1', 'syllabus.pdf · p. 2']]), []);
    expect(r).toEqual([{ nombre: 'Derivadas', fuente: 'syllabus.pdf · p. 2' }]);
  });

  it('un paso del plan con "[T1]" o "(F2)" en el título se guarda sin ellas', () => {
    const r = validarPlanGenerado(
      { dias: [{ fecha: '2026-11-25', pasos: [{ titulo: 'Repasar derivadas [T1] (F2)', tema: 'T1', minutos: 30, fuentes: ['F2'] }] }] },
      { temas: new Map([['T1', 'tema-1']]), etiquetas: new Map([['F2', 'libro.pdf · p. 4']]), hoy: '2026-11-24', fechaCorte: '2026-12-01', nuevoId: () => 'p1' },
    );
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r)).toContain('"titulo":"Repasar derivadas"');
  });
});
