// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODELO_CHAT, MODELO_CHAT_RESPALDO } from '@/lib/config/nova';

const generateContent = vi.fn();
const embedContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent, embedContent };
  },
}));

const DATOS = { sistema: 's', contexto: 'c', pregunta: 'p' };
const error = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

const errorCuota = (retryDelay: string) =>
  Object.assign(new Error(`{"error":{"details":[{"retryDelay":"${retryDelay}"}]}}`), { status: 429 });
const vector = { values: Array.from({ length: 768 }, () => 0.1) };

describe('llm.generarEmbeddings', () => {
  beforeEach(() => {
    embedContent.mockReset();
    vi.stubEnv('GEMINI_API_KEY', 'clave-de-prueba');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('un 429 por minuto espera lo que indica Gemini y continúa con el mismo lote', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    embedContent.mockRejectedValueOnce(errorCuota('0.01s')).mockResolvedValueOnce({ embeddings: [vector, vector] });
    await expect(llm.generarEmbeddings(['a', 'b'])).resolves.toHaveLength(2);
    expect(embedContent).toHaveBeenCalledTimes(2);
    expect(embedContent.mock.calls[1]?.[0].contents).toEqual(['a', 'b']);
  });

  it('una espera que no cabe (cuota diaria) falla enseguida con un mensaje claro', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    embedContent.mockRejectedValue(errorCuota('55385s'));
    const inicio = Date.now();
    await expect(llm.generarEmbeddings(['a'])).rejects.toMatchObject({
      codigo: 'ERROR_LLM',
      message: expect.stringContaining('límite de uso'),
    });
    expect(embedContent).toHaveBeenCalledTimes(1);
    expect(Date.now() - inicio).toBeLessThan(1000);
  });

  it('reparte en lotes de 20 para que un lote no supere por sí solo el límite por minuto', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    embedContent.mockImplementation(async ({ contents }: { contents: string[] }) => ({
      embeddings: contents.map(() => vector),
    }));
    await expect(llm.generarEmbeddings(Array.from({ length: 45 }, (_, i) => `t${i}`))).resolves.toHaveLength(45);
    expect(embedContent.mock.calls.map((c) => c[0].contents.length)).toEqual([20, 20, 5]);
  });
});

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
