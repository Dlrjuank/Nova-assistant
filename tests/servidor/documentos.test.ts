// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDF_MAX_BYTES } from '@/lib/config/nova';

const m = vi.hoisted(() => ({
  extraerTexto: vi.fn(),
  generarEmbeddings: vi.fn(),
  conTransaccion: vi.fn(),
  del: vi.fn(),
}));
vi.mock('@vercel/blob', () => ({ del: m.del }));
vi.mock('@/lib/pdf/extraer', () => ({ extraerTexto: m.extraerTexto }));
vi.mock('@/lib/llm/gemini', () => ({ llm: { generarEmbeddings: m.generarEmbeddings } }));
vi.mock('@/lib/db/conexion', () => ({
  aLiteralVector: (v: number[]) => `[${v.join(',')}]`,
  conTransaccion: m.conTransaccion,
  consultar: vi.fn(),
}));

import { indexarDocumento } from '@/lib/datos/documentos';

const DATOS = { urlBlob: 'https://x.public.blob.vercel-storage.com/a.pdf', nombreArchivo: 'a.pdf' };

/** Respuesta en trozos, como una descarga real; registra si se canceló la lectura. */
function respuestaEnTrozos(tamanos: number[]) {
  const estado = { cancelada: false };
  const pendientes = [...tamanos];
  const body = new ReadableStream<Uint8Array>({
    pull(controlador) {
      const tamano = pendientes.shift();
      if (tamano === undefined) controlador.close();
      else controlador.enqueue(new Uint8Array(tamano));
    },
    cancel() {
      estado.cancelada = true;
    },
  });
  return { respuesta: new Response(body), estado };
}

describe('indexarDocumento', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.extraerTexto.mockResolvedValue('hola\u0000 mundo');
    m.generarEmbeddings.mockResolvedValue([[0.1]]);
    m.conTransaccion.mockResolvedValue('doc-1');
    m.del.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('RN-01: acepta exactamente el límite, repartido en trozos', async () => {
    const { respuesta } = respuestaEnTrozos([PDF_MAX_BYTES - 1, 1]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta));
    await expect(indexarDocumento('u1', DATOS)).resolves.toEqual({ documentoId: 'doc-1', numFragmentos: 1 });
    expect((m.extraerTexto.mock.calls[0]?.[0] as Uint8Array).length).toBe(PDF_MAX_BYTES);
  });

  it('RN-01: un byte de más corta la descarga y no llega a Gemini', async () => {
    const { respuesta, estado } = respuestaEnTrozos([PDF_MAX_BYTES, 1, 1]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta));
    await expect(indexarDocumento('u1', DATOS)).rejects.toMatchObject({ codigo: 'ARCHIVO_MUY_GRANDE' });
    expect(estado.cancelada).toBe(true);
    expect(m.generarEmbeddings).not.toHaveBeenCalled();
  });

  it('una descarga fallida es PDF_INVALIDO', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no', { status: 404 })));
    await expect(indexarDocumento('u1', DATOS)).rejects.toMatchObject({ codigo: 'PDF_INVALIDO' });
  });

  it('RN-09: un PDF sin texto no llega a Gemini', async () => {
    m.extraerTexto.mockResolvedValue('  \n ');
    const { respuesta } = respuestaEnTrozos([10]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta));
    await expect(indexarDocumento('u1', DATOS)).rejects.toMatchObject({ codigo: 'PDF_SIN_TEXTO' });
    expect(m.generarEmbeddings).not.toHaveBeenCalled();
  });

  it('borra el PDF del Blob al indexar', async () => {
    const { respuesta } = respuestaEnTrozos([10]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta));
    await indexarDocumento('u1', DATOS);
    expect(m.del).toHaveBeenCalledWith(DATOS.urlBlob);
  });

  it('borra el PDF del Blob aunque se rechace', async () => {
    m.extraerTexto.mockResolvedValue('');
    const { respuesta } = respuestaEnTrozos([10]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta));
    await expect(indexarDocumento('u1', DATOS)).rejects.toMatchObject({ codigo: 'PDF_SIN_TEXTO' });
    expect(m.del).toHaveBeenCalledWith(DATOS.urlBlob);
  });

  it('un fallo al borrar no invalida la indexación', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    m.del.mockRejectedValue(new Error('sin red'));
    const { respuesta } = respuestaEnTrozos([10]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta));
    await expect(indexarDocumento('u1', DATOS)).resolves.toMatchObject({ documentoId: 'doc-1' });
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });

  it('quita el carácter NUL, que Postgres rechaza', async () => {
    const { respuesta } = respuestaEnTrozos([10]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta));
    await indexarDocumento('u1', DATOS);
    expect(m.generarEmbeddings).toHaveBeenCalledWith(['hola mundo']);
  });
});
