// @vitest-environment node
// E20c-1 (7.15, RB-78): el cliente de Gemini con la clave de cada persona: errores de su clave, conteo y contexto.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODELO_CHAT } from '@/lib/config/nova';

const m = vi.hoisted(() => ({
  generateContent: vi.fn(),
  embedContent: vi.fn(),
  claves: [] as string[],
  resolverClave: vi.fn(),
  marcarEstadoClave: vi.fn(),
  registrar: vi.fn(),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor({ apiKey }: { apiKey: string }) {
      m.claves.push(apiKey);
    }
    models = { generateContent: m.generateContent, embedContent: m.embedContent };
  },
}));
vi.mock('@/lib/datos/claveGemini', () => ({ resolverClave: m.resolverClave, marcarEstadoClave: m.marcarEstadoClave }));

import { llm } from '@/lib/llm/gemini';
import { alTerminarIa, conIaDe, usaIa } from '@/lib/llm/contextoIa';

const U = '11111111-1111-4111-8111-111111111111';
const DATOS = { sistema: 's', contexto: 'c', pregunta: 'p' };
const error = (status: number, mensaje = `HTTP ${status}`) => Object.assign(new Error(mensaje), { status });

beforeEach(() => {
  vi.resetAllMocks();
  m.claves.length = 0;
  m.resolverClave.mockResolvedValue({ apiKey: 'clave-de-la-persona-0123456789', origen: 'propia', estado: 'activa' });
  m.marcarEstadoClave.mockResolvedValue(undefined);
  m.registrar.mockResolvedValue(undefined);
  alTerminarIa(m.registrar);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('RB-76: la clave de quien usa la IA', () => {
  it('fuera de conIaDe no llama a Gemini (nunca cae en la clave del proyecto por olvido)', async () => {
    await expect(llm.responder(DATOS)).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
    expect(m.generateContent).not.toHaveBeenCalled();
    expect(m.resolverClave).not.toHaveBeenCalled();
  });

  it('dentro de conIaDe usa la clave de esa persona y cuenta cada llamada a Gemini (solo el número)', async () => {
    m.generateContent.mockResolvedValue({ text: 'hola' });
    m.embedContent.mockResolvedValue({ embeddings: [{ values: Array.from({ length: 768 }, () => 0) }] });
    await conIaDe(U, async () => {
      await llm.responder(DATOS);
      await llm.generarEmbedding('x');
    });
    expect(m.resolverClave).toHaveBeenCalledWith(U);
    expect(m.claves).toEqual(['clave-de-la-persona-0123456789', 'clave-de-la-persona-0123456789']);
    expect(m.registrar).toHaveBeenCalledWith(U, 2);
  });

  it('sin clave: el error de RB-79 llega tal cual, sin llamar a Gemini ni contar', async () => {
    const { ErrorDeNegocio } = await import('@/lib/reglas/errores');
    m.resolverClave.mockRejectedValue(new ErrorDeNegocio('SIN_CLAVE_GEMINI'));
    await expect(conIaDe(U, () => llm.responder(DATOS))).rejects.toMatchObject({ codigo: 'SIN_CLAVE_GEMINI' });
    expect(m.generateContent).not.toHaveBeenCalled();
    expect(m.registrar).not.toHaveBeenCalled();
  });

  it('usaIa corre el servicio con el usuario de su primer argumento; dentro, otro conIaDe del mismo usuario reusa el contexto', async () => {
    m.generateContent.mockResolvedValue({ text: 'hola' });
    const servicio = usaIa(async (usuarioId: string, n: number) => {
      await conIaDe(usuarioId, () => llm.responder(DATOS));
      return n;
    });
    await expect(servicio(U, 7)).resolves.toBe(7);
    expect(m.registrar).toHaveBeenCalledTimes(1);
    expect(m.registrar).toHaveBeenCalledWith(U, 1);
  });
});

describe('7.15 · RB-78: errores de la clave propia', () => {
  it('401 o 403 de Google: la clave queda rechazada y se dice así (sin pasar al respaldo ni a otra clave)', async () => {
    for (const status of [401, 403]) {
      m.generateContent.mockReset().mockRejectedValue(error(status));
      await expect(conIaDe(U, () => llm.responder(DATOS))).rejects.toMatchObject({ codigo: 'CLAVE_GEMINI_RECHAZADA' });
      expect(m.generateContent).toHaveBeenCalledTimes(1);
    }
    expect(m.marcarEstadoClave).toHaveBeenCalledWith(U, 'rechazada');
  });

  it('400 API_KEY_INVALID también es rechazada; otro 400 no toca la clave', async () => {
    m.generateContent.mockRejectedValue(error(400, '{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}'));
    await expect(conIaDe(U, () => llm.responder(DATOS))).rejects.toMatchObject({ codigo: 'CLAVE_GEMINI_RECHAZADA' });
    m.marcarEstadoClave.mockClear();
    m.generateContent.mockReset().mockRejectedValue(error(400, 'contenido no válido'));
    await expect(conIaDe(U, () => llm.responder(DATOS))).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
    expect(m.marcarEstadoClave).not.toHaveBeenCalled();
  });

  it('429 en los dos modelos (con su misma clave): sin cuota, con el mensaje de RB-78', async () => {
    m.generateContent.mockRejectedValue(error(429));
    await expect(conIaDe(U, () => llm.responder(DATOS))).rejects.toMatchObject({ codigo: 'CUOTA_CLAVE_AGOTADA' });
    expect(m.generateContent).toHaveBeenCalledTimes(2); // el principal y el respaldo, los dos con la clave de la persona
    expect(m.claves.every((c) => c === 'clave-de-la-persona-0123456789')).toBe(true);
    expect(m.marcarEstadoClave).toHaveBeenCalledWith(U, 'sin_cuota');
  });

  it('al indexar sin esperar (RB-57), un 429 deja la clave sin cuota para el minuto siguiente', async () => {
    m.embedContent.mockRejectedValue(Object.assign(new Error('{"retryDelay":"30s"}'), { status: 429 }));
    await expect(conIaDe(U, () => llm.generarEmbeddings(['a'], { sinEsperarCuota: true }))).rejects.toMatchObject({ codigo: 'CUOTA_CLAVE_AGOTADA' });
  });

  it('una clave que estaba sin cuota y vuelve a responder queda activa', async () => {
    m.resolverClave.mockResolvedValue({ apiKey: 'clave-de-la-persona-0123456789', origen: 'propia', estado: 'sin_cuota' });
    m.generateContent.mockResolvedValue({ text: 'hola' });
    await conIaDe(U, () => llm.responder(DATOS));
    expect(m.marcarEstadoClave).toHaveBeenCalledWith(U, 'activa');
  });

  it('con la clave del proyecto (dueño), un 403 no marca nada: es un error de Nova', async () => {
    m.resolverClave.mockResolvedValue({ apiKey: 'clave-del-proyecto', origen: 'proyecto', estado: null });
    m.generateContent.mockRejectedValue(error(403));
    await expect(conIaDe(U, () => llm.responder(DATOS))).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
    expect(m.marcarEstadoClave).not.toHaveBeenCalled();
  });

  it('el registro de un fallo no lleva la clave', async () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => {});
    m.generateContent.mockRejectedValue(error(500, `fallo con key=AIza${'S'.repeat(35)}`));
    await expect(conIaDe(U, () => llm.responder(DATOS))).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
    expect(JSON.stringify(registro.mock.calls)).not.toContain('AIzaSSS');
    expect(m.generateContent.mock.calls[0]?.[0].model).toBe(MODELO_CHAT);
  });
});
