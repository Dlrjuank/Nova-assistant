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

const F1 = { nombre_archivo: 'a.pdf', numero: 1, contenido: 'uno' };
const F2 = { nombre_archivo: 'a.pdf', numero: 2, contenido: 'dos' };
const T1 = { id: '1a2b3c4d-0000', texto: 'Pagar luz' };

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
    await expect(consultar('Agenda')).rejects.toMatchObject({ codigo: 'CONSULTA_MUY_CORTA' });
    expect(m.generarEmbedding).not.toHaveBeenCalled();
  });

  it('sin documentos responde SIN_DOCUMENTOS y no llama a Gemini', async () => {
    m.existenDocumentos.mockResolvedValue(false);
    await expect(consultar('Mi agenda de hoy')).rejects.toMatchObject({ codigo: 'SIN_DOCUMENTOS' });
    expect(m.generarEmbedding).not.toHaveBeenCalled();
  });

  it('recupera 4 fragmentos y no incluye tareas si la pregunta no las menciona', async () => {
    m.responder.mockResolvedValue('Dice uno [a.pdf · fragmento 1].');
    const r = await consultar('¿Qué dice la factura?');
    expect(m.recuperarFragmentos).toHaveBeenCalledWith([0.1], 4);
    expect(m.tareasPendientesComoTexto).not.toHaveBeenCalled();
    expect(r.fuentes).toEqual([{ tipo: 'pdf', etiqueta: 'a.pdf · fragmento 1' }]);
  });

  it('incluye las tareas pendientes si la pregunta las menciona', async () => {
    m.responder.mockResolvedValue('Pagar luz [Tarea 1a2b3c4d].');
    const r = await consultar('¿Qué tareas tengo pendientes?');
    expect(m.responder.mock.calls[0]?.[0].contexto).toContain('Pagar luz');
    expect(r.fuentes).toEqual([{ tipo: 'tarea', etiqueta: 'Tarea 1a2b3c4d' }]);
  });

  it('sin respuesta en el contexto devuelve el mensaje exacto y ninguna fuente', async () => {
    m.responder.mockResolvedValue('No encontré esto en tus documentos.');
    await expect(consultar('¿Cuál es la capital de Mongolia?')).resolves.toEqual({
      respuesta: 'No encontré esto en tus documentos',
      fuentes: [],
    });
  });
});
