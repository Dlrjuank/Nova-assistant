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

  it('desde el Asistente cada intento tiene tope; la indexación no', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    embedContent.mockResolvedValue({ embeddings: [vector] });
    await llm.generarEmbedding('a');
    await llm.generarEmbeddings(['a'], { interactivo: true });
    await llm.generarEmbeddings(['a']);
    expect(embedContent.mock.calls.map((c) => c[0].config.httpOptions?.timeout)).toEqual([10_000, 10_000, undefined]);
  });
});

describe('llm.responder', () => {
  beforeEach(() => {
    vi.resetModules(); // la memoria de saturación vive en el módulo
    generateContent.mockReset();
    vi.stubEnv('GEMINI_API_KEY', 'clave-de-prueba');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('RN-21: el historial va como turnos user/model y el contexto solo acompaña a la pregunta nueva', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockResolvedValueOnce({ text: 'ok' });
    await llm.responder({
      ...DATOS,
      historial: [
        { autor: 'usuario', texto: '¿Cuáles son los pasos?' },
        { autor: 'asistente', texto: 'Primero y segundo.' },
      ],
    });
    const { contents } = generateContent.mock.calls[0]?.[0];
    expect(contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(contents[0].parts[0].text).toBe('¿Cuáles son los pasos?');
    expect(contents[1].parts[0].text).toBe('Primero y segundo.');
    expect(contents[2].parts[0].text).toContain('CONTEXTO:');
    expect(contents[2].parts[0].text).toContain(`PREGUNTA:\n${DATOS.pregunta}`);
  });

  it('un 503 del principal pasa al respaldo sin reintentar', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockRejectedValueOnce(error(503)).mockResolvedValueOnce({ text: ' hola ' });
    await expect(llm.responder(DATOS)).resolves.toBe('hola');
    expect(generateContent.mock.calls.map((c) => c[0].model)).toEqual([MODELO_CHAT, MODELO_CHAT_RESPALDO]);
  });

  it('el principal que no contesta a tiempo cede al respaldo, con un tope por llamada', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' })).mockResolvedValueOnce({ text: 'respaldo' });
    await expect(llm.responder(DATOS)).resolves.toBe('respaldo');
    const [principal, respaldo] = generateContent.mock.calls.map((c) => c[0].config.httpOptions.timeout);
    expect(principal).toBe(15_000);
    expect(respaldo).toBeGreaterThan(30_000);
    expect(respaldo).toBeLessThanOrEqual(40_000);
  });

  it('el respaldo reintenta una saturación momentánea', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockRejectedValueOnce(error(503)).mockRejectedValueOnce(error(503)).mockResolvedValueOnce({ text: 'por fin' });
    await expect(llm.responder(DATOS)).resolves.toBe('por fin');
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('con el tiempo agotado no reintenta el respaldo y sale como ERROR_LLM', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    const inicio = Date.now();
    const ahora = vi.spyOn(Date, 'now');
    generateContent.mockRejectedValueOnce(error(503)).mockImplementationOnce(async () => {
      ahora.mockReturnValue(inicio + 41_000);
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    await expect(llm.responder(DATOS)).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
    expect(generateContent).toHaveBeenCalledTimes(2);
    ahora.mockRestore();
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

  it('E10b: una conexión cortada pasa al respaldo', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce({ text: ' hola ' });
    await expect(llm.responder(DATOS)).resolves.toBe('hola');
    expect(generateContent).toHaveBeenLastCalledWith(expect.objectContaining({ model: MODELO_CHAT_RESPALDO }));
  });

  it('una cuota agotada (429) no reintenta y pasa directo al respaldo', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockRejectedValueOnce(error(429)).mockResolvedValueOnce({ text: 'respaldo' });
    await expect(llm.responder(DATOS)).resolves.toBe('respaldo');
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent).toHaveBeenLastCalledWith(expect.objectContaining({ model: MODELO_CHAT_RESPALDO }));
  });

  it('un texto largo da 75 s al principal y hasta 110 s en total', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockRejectedValueOnce(error(504)).mockResolvedValueOnce({ text: 'respaldo' });
    await expect(llm.responder({ ...DATOS, contexto: 'x'.repeat(30_000) })).resolves.toBe('respaldo');
    const [principal, respaldo] = generateContent.mock.calls.map((c) => c[0].config.httpOptions.timeout);
    expect(principal).toBe(75_000);
    expect(respaldo).toBeGreaterThan(100_000);
    expect(respaldo).toBeLessThanOrEqual(110_000);
  });

  it('una pregunta normal sigue con 15 s', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockResolvedValueOnce({ text: 'ok' });
    await llm.responder({ ...DATOS, contexto: 'x'.repeat(29_999) });
    expect(generateContent.mock.calls[0]?.[0].config.httpOptions.timeout).toBe(15_000);
  });

  describe('memoria de saturación', () => {
    const modelos = () => generateContent.mock.calls.map((c) => c[0].model);
    const abortado = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
    const ok = { text: 'ok' };

    it.each([
      ['un 503', () => error(503)],
      ['un modelo que no contesta (corte propio)', abortado],
      ['un modelo que no contesta (504 de Gemini)', () => error(504)],
    ])('tras %s, la siguiente pregunta va directo al respaldo', async (_, fallo) => {
      const { llm } = await import('@/lib/llm/gemini');
      generateContent.mockRejectedValueOnce(fallo()).mockResolvedValue(ok);
      await llm.responder(DATOS);
      generateContent.mockClear();
      await llm.responder(DATOS);
      expect(modelos()).toEqual([MODELO_CHAT_RESPALDO]);
    });

    it.each([
      ['una cuota agotada', () => error(429)],
      ['un error interno', () => error(500)],
      ['una conexión cortada', () => new TypeError('fetch failed')],
    ])('%s no activa la memoria', async (_, fallo) => {
      const { llm } = await import('@/lib/llm/gemini');
      generateContent.mockRejectedValueOnce(fallo()).mockResolvedValue(ok);
      await llm.responder(DATOS);
      generateContent.mockClear();
      await llm.responder(DATOS);
      expect(modelos()).toEqual([MODELO_CHAT]);
    });

    it.each([
      ['corte propio', abortado],
      ['504', () => error(504)],
    ])('un %s con un contexto largo cede al respaldo sin activarla: puede ser una respuesta larga', async (_, fallo) => {
      const { llm } = await import('@/lib/llm/gemini');
      generateContent.mockRejectedValueOnce(fallo()).mockResolvedValue(ok);
      await llm.responder({ ...DATOS, contexto: 'x'.repeat(30_000) });
      generateContent.mockClear();
      await llm.responder(DATOS);
      expect(modelos()).toEqual([MODELO_CHAT]);
    });

    it('un texto largo la ignora y empieza por el principal', async () => {
      const { llm } = await import('@/lib/llm/gemini');
      generateContent.mockRejectedValueOnce(error(503)).mockResolvedValue(ok);
      await llm.responder(DATOS);
      generateContent.mockClear();
      await llm.responder({ ...DATOS, contexto: 'x'.repeat(30_000) });
      expect(modelos()).toEqual([MODELO_CHAT]);
      generateContent.mockClear();
      await llm.responder(DATOS);
      expect(modelos()).toEqual([MODELO_CHAT_RESPALDO]);
    });

    it('dura 5 minutos', async () => {
      const { llm } = await import('@/lib/llm/gemini');
      generateContent.mockRejectedValueOnce(error(503)).mockResolvedValue(ok);
      await llm.responder(DATOS);
      generateContent.mockClear();
      const ahora = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60_000 + 1);
      await llm.responder(DATOS);
      ahora.mockRestore();
      expect(modelos()).toEqual([MODELO_CHAT]);
    });

    it.each([
      ['sin cuota', () => error(429)],
      ['con otro error', () => error(404)],
    ])('con la memoria activa y el respaldo %s, responde el principal y la memoria se borra', async (_, fallo) => {
      const { llm } = await import('@/lib/llm/gemini');
      generateContent.mockRejectedValueOnce(error(503)).mockResolvedValueOnce(ok);
      await llm.responder(DATOS);
      generateContent.mockReset();
      generateContent.mockRejectedValueOnce(fallo()).mockResolvedValue({ text: 'del principal' });
      await expect(llm.responder(DATOS)).resolves.toBe('del principal');
      expect(modelos()).toEqual([MODELO_CHAT_RESPALDO, MODELO_CHAT]);
      generateContent.mockClear();
      await llm.responder(DATOS);
      expect(modelos()).toEqual([MODELO_CHAT]);
    });

    it('si ninguno responde, la siguiente pregunta vuelve a probar el principal', async () => {
      const { llm } = await import('@/lib/llm/gemini');
      generateContent.mockRejectedValueOnce(error(503)).mockRejectedValueOnce(error(429));
      await expect(llm.responder(DATOS)).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
      generateContent.mockReset();
      generateContent.mockResolvedValue(ok);
      await llm.responder(DATOS);
      expect(modelos()).toEqual([MODELO_CHAT]);
    });
  });

  it('E10c3: sin contexto, el turno nuevo es solo la pregunta', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockResolvedValueOnce({ text: 'ok' });
    await llm.responder({ ...DATOS, contexto: '' });
    expect(generateContent.mock.calls[0]?.[0].contents.at(-1).parts[0].text).toBe(DATOS.pregunta);
  });

  it('un error no temporal no reintenta y sale como ERROR_LLM', async () => {
    const { llm } = await import('@/lib/llm/gemini');
    generateContent.mockRejectedValue(error(404));
    await expect(llm.responder(DATOS)).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
