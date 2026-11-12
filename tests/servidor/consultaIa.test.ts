// @vitest-environment node
// S-65 (E10c3, RB-59): la IA general solo usa el modelo de chat, sin embeddings ni datos del usuario.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ responder: vi.fn(), generarEmbedding: vi.fn(), generarEmbeddings: vi.fn() }));
vi.mock('@/lib/llm/gemini', () => ({ llm: m }));

import { responderConIa } from '@/lib/datos/consultaIa';
import { SYSTEM_PROMPT_IA } from '@/lib/llm/prompts';

describe('responderConIa', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.responder.mockResolvedValue('Un número primo solo se divide entre 1 y sí mismo.');
  });

  it('llama solo al chat, sin contexto ni embeddings, y no devuelve fuentes', async () => {
    const historial = [{ autor: 'usuario' as const, texto: 'antes' }];
    await expect(responderConIa('  qué es   un número primo ', historial)).resolves.toEqual({
      respuesta: 'Un número primo solo se divide entre 1 y sí mismo.',
      fuentes: [],
    });
    expect(m.responder).toHaveBeenCalledWith({ sistema: SYSTEM_PROMPT_IA, contexto: '', pregunta: 'qué es un número primo', historial });
    expect(m.generarEmbedding).not.toHaveBeenCalled();
    expect(m.generarEmbeddings).not.toHaveBeenCalled();
  });

  it('el prompt no habla de fragmentos, tareas ni etiquetas que citar', () => {
    for (const palabra of ['FRAGMENTOS', 'TAREAS PENDIENTES', 'HOY', '[Tarea', '.pdf']) expect(SYSTEM_PROMPT_IA).not.toContain(palabra);
    expect(SYSTEM_PROMPT_IA).toContain('conocimiento general');
  });

  it('RN-02: una pregunta corta no gasta cuota', async () => {
    await expect(responderConIa('hola')).rejects.toMatchObject({ codigo: 'CONSULTA_MUY_CORTA' });
    expect(m.responder).not.toHaveBeenCalled();
  });
});
