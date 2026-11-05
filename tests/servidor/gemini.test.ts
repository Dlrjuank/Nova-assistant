// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODELO_CHAT, MODELO_CHAT_RESPALDO } from '@/lib/config/nova';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const DATOS = { sistema: 's', contexto: 'c', pregunta: 'p' };
const error = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

describe('llm.responder', () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.stubEnv('GEMINI_API_KEY', 'clave-de-prueba');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('reintenta ante un 503 y devuelve la respuesta', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockRejectedValueOnce(error(503)).mockResolvedValueOnce({ text: ' hola ' });
    await expect(llm.responder(DATOS)).resolves.toBe('hola');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('pasa al modelo de respaldo si el principal sigue saturado', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockImplementation(async ({ model }: { model: string }) => {
      if (model === MODELO_CHAT) throw error(503);
      return { text: 'respaldo' };
    });
    await expect(llm.responder(DATOS)).resolves.toBe('respaldo');
    expect(generateContent).toHaveBeenLastCalledWith(expect.objectContaining({ model: MODELO_CHAT_RESPALDO }));
  }, 15_000);

  it('una cuota agotada (429) no reintenta y pasa directo al respaldo', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockRejectedValueOnce(error(429)).mockResolvedValueOnce({ text: 'respaldo' });
    await expect(llm.responder(DATOS)).resolves.toBe('respaldo');
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent).toHaveBeenLastCalledWith(expect.objectContaining({ model: MODELO_CHAT_RESPALDO }));
  });

  it('un error no temporal no reintenta y sale como ERROR_LLM', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockRejectedValue(error(404));
    await expect(llm.responder(DATOS)).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
