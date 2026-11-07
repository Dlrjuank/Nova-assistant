// @vitest-environment node
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
vi.mock('@/lib/llm/gemini', () => ({
  llm: { generarEmbedding: m.generarEmbedding, responder: m.responder },
}));

import { armarFuentes, consultar } from '@/lib/datos/consulta';
import { construirContexto } from '@/lib/llm/prompts';

const U = '33333333-3333-4333-8333-333333333333';
const F1 = { nombre_archivo: 'a.pdf', numero: 1, contenido: 'uno' };
const F2 = { nombre_archivo: 'a.pdf', numero: 2, contenido: 'dos' };
const T1 = { id: '1a2b3c4d-0000', texto: 'Pagar luz' };

describe('construirContexto', () => {
  it('encabeza cada fuente con su etiqueta citable, sin índices como [1] o [T1]', () => {
    const contexto = construirContexto([F1], [T1]);
    expect(contexto).toContain('[a.pdf · fragmento 1]\nuno');
    expect(contexto).toContain('[Tarea 1a2b3c4d]\nPagar luz');
    expect(contexto).not.toMatch(/\[T?\d+\]/);
  });
});

describe('armarFuentes', () => {
  it('deja solo las fuentes citadas por el modelo', () => {
    expect(armarFuentes('Dura 24 meses [a.pdf · fragmento 2].', [F1, F2], [T1])).toEqual([
      { tipo: 'pdf', etiqueta: 'a.pdf · fragmento 2' },
    ]);
  });
  it('"fragmento 1" no coincide dentro de "fragmento 12"', () => {
    const f12 = { ...F1, numero: 12 };
    expect(armarFuentes('Según [a.pdf · fragmento 12].', [F1, f12], [])).toEqual([
      { tipo: 'pdf', etiqueta: 'a.pdf · fragmento 12' },
    ]);
  });
  it('un nombre de archivo con caracteres especiales se cita bien', () => {
    const raro = { ...F1, nombre_archivo: 'factura (1)+.pdf' };
    expect(armarFuentes('Según [factura (1)+.pdf · fragmento 1].', [raro], [T1])).toEqual([
      { tipo: 'pdf', etiqueta: 'factura (1)+.pdf · fragmento 1' },
    ]);
  });
  it('sin citas reconocibles devuelve todas las entregadas', () => {
    expect(armarFuentes('Dura 24 meses.', [F1], [T1])).toEqual([
      { tipo: 'pdf', etiqueta: 'a.pdf · fragmento 1' },
      { tipo: 'tarea', etiqueta: 'Tarea 1a2b3c4d' },
    ]);
  });
});

describe('consultar', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.existenDocumentos.mockResolvedValue(true);
    m.generarEmbedding.mockResolvedValue([0.1]);
    m.recuperarFragmentos.mockResolvedValue([F1]);
    m.tareasPendientesComoTexto.mockResolvedValue([T1]);
  });

  it('una consulta corta no llega a Gemini', async () => {
    await expect(consultar(U, 'Agenda')).rejects.toMatchObject({ codigo: 'CONSULTA_MUY_CORTA' });
    expect(m.generarEmbedding).not.toHaveBeenCalled();
  });


  it('recupera 4 fragmentos y no incluye tareas si la pregunta no las menciona', async () => {
    m.responder.mockResolvedValue('Dice uno [a.pdf · fragmento 1].');
    const r = await consultar(U, '¿Qué dice la factura?');
    expect(m.recuperarFragmentos).toHaveBeenCalledWith(U, [0.1], 4);
    expect(m.tareasPendientesComoTexto).not.toHaveBeenCalled();
    expect(r.fuentes).toEqual([{ tipo: 'pdf', etiqueta: 'a.pdf · fragmento 1' }]);
  });

  it('RB-01: documentos, fragmentos y tareas se buscan solo del usuario de la sesión', async () => {
    m.responder.mockResolvedValue('Pagar luz [Tarea 1a2b3c4d].');
    await consultar(U, '¿Qué tareas tengo pendientes?');
    expect(m.existenDocumentos).toHaveBeenCalledWith(U);
    expect(m.recuperarFragmentos.mock.calls[0]?.[0]).toBe(U);
    expect(m.tareasPendientesComoTexto).toHaveBeenCalledWith(U);
  });

  it('incluye las tareas pendientes si la pregunta las menciona', async () => {
    m.responder.mockResolvedValue('Pagar luz [Tarea 1a2b3c4d].');
    const r = await consultar(U, '¿Qué tareas tengo pendientes?');
    expect(m.responder.mock.calls[0]?.[0].contexto).toContain('Pagar luz');
    expect(r.fuentes).toEqual([{ tipo: 'tarea', etiqueta: 'Tarea 1a2b3c4d' }]);
  });

  it('RN-21 seguimiento "¿y el segundo?": busca con la pregunta anterior y la nueva, y el modelo recibe el historial', async () => {
    m.responder.mockResolvedValue('El segundo paso es secar [a.pdf · fragmento 1].');
    const historial = [
      { autor: 'usuario' as const, texto: '¿Cuáles son los pasos de limpieza del horno?' },
      { autor: 'asistente' as const, texto: 'Primero, retirar la bandeja; segundo, secarla [a.pdf · fragmento 1].' },
    ];
    await consultar(U, '¿y el segundo?', historial);
    expect(m.generarEmbedding).toHaveBeenCalledWith('¿Cuáles son los pasos de limpieza del horno?\n¿y el segundo?');
    const llamada = m.responder.mock.calls[0]?.[0];
    expect(llamada.pregunta).toBe('¿y el segundo?');
    expect(llamada.historial).toEqual(historial);
  });

  it('RN-21: un seguimiento de una pregunta sobre tareas también recibe las tareas', async () => {
    m.responder.mockResolvedValue('Pagar luz [Tarea 1a2b3c4d].');
    await consultar(U, '¿y la más urgente?', [
      { autor: 'usuario', texto: '¿Qué tareas tengo pendientes?' },
      { autor: 'asistente', texto: 'Pagar luz.' },
    ]);
    expect(m.tareasPendientesComoTexto).toHaveBeenCalled();
  });

  it('sin historial busca solo con la pregunta nueva', async () => {
    m.responder.mockResolvedValue('Dice uno [a.pdf · fragmento 1].');
    await consultar(U, '  ¿Qué dice   la factura? ');
    expect(m.generarEmbedding).toHaveBeenCalledWith('¿Qué dice la factura?');
    expect(m.responder.mock.calls[0]?.[0].historial).toEqual([]);
  });

  it('sin respuesta en el contexto devuelve el mensaje exacto y ninguna fuente', async () => {
    m.responder.mockResolvedValue('No encontré esto en tus documentos.');
    await expect(consultar(U, '¿Cuál es la capital de Mongolia?')).resolves.toEqual({
      respuesta: 'No encontré esto en tus documentos',
      fuentes: [],
    });
  });
});

describe('RB-30: con documentos, solo tareas, solo documentos o ninguno', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.generarEmbedding.mockResolvedValue([0.1]);
    m.recuperarFragmentos.mockResolvedValue([F1]);
  });

  it('con documentos y tareas: flujo normal (vector, fragmentos y tareas si la pregunta las menciona)', async () => {
    m.existenDocumentos.mockResolvedValue(true);
    m.tareasPendientesComoTexto.mockResolvedValue([T1]);
    m.responder.mockResolvedValue('Pagar luz [Tarea 1a2b3c4d].');
    const r = await consultar(U, '¿Qué tareas tengo pendientes?');
    expect(m.generarEmbedding).toHaveBeenCalled();
    expect(m.recuperarFragmentos).toHaveBeenCalled();
    expect(m.responder.mock.calls[0]?.[0].contexto).toContain('[a.pdf · fragmento 1]');
    expect(r.fuentes).toEqual([{ tipo: 'tarea', etiqueta: 'Tarea 1a2b3c4d' }]);
  });

  it('solo tareas: responde con las tareas aunque la pregunta no diga "tarea", sin vector ni fragmentos', async () => {
    m.existenDocumentos.mockResolvedValue(false);
    m.tareasPendientesComoTexto.mockResolvedValue([T1]);
    m.responder.mockResolvedValue('Debes pagar la luz [Tarea 1a2b3c4d].');
    const r = await consultar(U, '¿Cuándo debo pagar lo de la luz?');
    expect(m.generarEmbedding).not.toHaveBeenCalled();
    expect(m.recuperarFragmentos).not.toHaveBeenCalled();
    expect(m.tareasPendientesComoTexto).toHaveBeenCalledWith(U);
    const { contexto } = m.responder.mock.calls[0]?.[0];
    expect(contexto).toContain('Pagar luz');
    expect(contexto).not.toContain('fragmento');
    expect(r).toEqual({ respuesta: 'Debes pagar la luz [Tarea 1a2b3c4d].', fuentes: [{ tipo: 'tarea', etiqueta: 'Tarea 1a2b3c4d' }] });
  });

  it('solo tareas: una pregunta de PDF responde el mensaje exacto, sin fuentes', async () => {
    m.existenDocumentos.mockResolvedValue(false);
    m.tareasPendientesComoTexto.mockResolvedValue([T1]);
    m.responder.mockResolvedValue('No encontré esto en tus documentos.');
    await expect(consultar(U, '¿Cuánto dura la garantía del purificador?')).resolves.toEqual({
      respuesta: 'No encontré esto en tus documentos',
      fuentes: [],
    });
  });

  it('solo documentos: flujo normal; una pregunta de tareas no lleva tareas al contexto', async () => {
    m.existenDocumentos.mockResolvedValue(true);
    m.tareasPendientesComoTexto.mockResolvedValue([]);
    m.responder.mockResolvedValue('No encontré esto en tus documentos.');
    const r = await consultar(U, '¿Qué tareas tengo pendientes?');
    expect(m.generarEmbedding).toHaveBeenCalled();
    expect(m.responder.mock.calls[0]?.[0].contexto).not.toContain('Tarea ');
    expect(r).toEqual({ respuesta: 'No encontré esto en tus documentos', fuentes: [] });
  });

  it('ni documentos ni tareas pendientes: SIN_DOCUMENTOS sin llamar a Gemini', async () => {
    m.existenDocumentos.mockResolvedValue(false);
    m.tareasPendientesComoTexto.mockResolvedValue([]);
    await expect(consultar(U, 'Mi agenda de hoy')).rejects.toMatchObject({ codigo: 'SIN_DOCUMENTOS' });
    expect(m.generarEmbedding).not.toHaveBeenCalled();
    expect(m.responder).not.toHaveBeenCalled();
  });
});
