// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDF_MAX_BYTES } from '@/lib/config/nova';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  extraerPdf: vi.fn(),
  generarEmbeddings: vi.fn(),
  conTransaccion: vi.fn(),
  consultar: vi.fn(),
  del: vi.fn(),
  tx: { query: vi.fn() },
}));
vi.mock('@vercel/blob', () => ({ del: m.del }));
vi.mock('@/lib/pdf/extraer', () => ({ extraerPdf: m.extraerPdf }));
vi.mock('@/lib/llm/gemini', () => ({ llm: { generarEmbeddings: m.generarEmbeddings } }));
vi.mock('@/lib/db/conexion', () => ({
  aLiteralVector: (v: number[]) => `[${v.join(',')}]`,
  conTransaccion: m.conTransaccion,
  consultar: m.consultar,
}));

import { capitulosDeDocumento, continuarIndexacion, indexarContenido, indexarDocumento } from '@/lib/datos/documentos';

const DATOS = { urlBlob: 'https://x.public.blob.vercel-storage.com/a.pdf', nombreArchivo: 'a.pdf' };
const extraido = (paginas: string[], extra = {}) => ({ paginas, etiquetas: null, indice: [], ...extra });
/** Un PDF de `n` fragmentos: cada uno ocupa 450 palabras nuevas (RN-10). */
const paginasPara = (n: number) => [Array.from({ length: 450 * n + 50 }, (_, i) => `p${i}`).join(' ')];
const sentencias = () => m.tx.query.mock.calls.map((c) => String(c[0]));
const insercionesDeFragmentos = () => m.tx.query.mock.calls.filter((c) => String(c[0]).includes('INSERT INTO fragmentos_pdf'));

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
    m.extraerPdf.mockResolvedValue(extraido(['hola\u0000 mundo']));
    m.generarEmbeddings.mockImplementation(async (textos: string[]) => textos.map(() => [0.1]));
    m.tx.query.mockImplementation(async () => ({ rows: [{ id: 'doc-1' }] }));
    m.conTransaccion.mockImplementation((trabajo: (tx: typeof m.tx) => unknown) => trabajo(m.tx));
    m.consultar.mockResolvedValue([]);
    m.del.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('RN-01: acepta exactamente el límite, repartido en trozos', async () => {
    const { respuesta } = respuestaEnTrozos([PDF_MAX_BYTES - 1, 1]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta));
    await expect(indexarDocumento('u1', DATOS)).resolves.toEqual({ documentoId: 'doc-1', numFragmentos: 1, progreso: null });
    expect((m.extraerPdf.mock.calls[0]?.[0] as Uint8Array).length).toBe(PDF_MAX_BYTES);
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
    m.extraerPdf.mockResolvedValue(extraido(['  \n ']));
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
    m.extraerPdf.mockResolvedValue(extraido(['']));
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
    expect(m.generarEmbeddings.mock.calls[0]?.[0]).toEqual(['hola mundo']);
  });

  it('RB-38: más de 800 páginas se rechaza sin crear nada', async () => {
    m.extraerPdf.mockResolvedValue(extraido(Array.from({ length: 801 }, () => 'texto')));
    await expect(indexarContenido('u1', new Uint8Array(1), { nombreArchivo: 'a.pdf' })).rejects.toMatchObject({
      codigo: 'PDF_MUY_LARGO',
      message: 'El PDF tiene 801 páginas; el máximo es 800.',
    });
    expect(m.conTransaccion).not.toHaveBeenCalled();
  });

  it('guarda páginas y capítulos del usuario y termina sin pendientes', async () => {
    m.extraerPdf.mockResolvedValue(extraido(['Capítulo 1\nUno', 'Capítulo 2\nDos']));
    await expect(indexarContenido('u1', new Uint8Array(1), { nombreArchivo: 'a.pdf' })).resolves.toEqual({ documentoId: 'doc-1', numFragmentos: 1, progreso: null });
    const documento = m.tx.query.mock.calls.find((c) => String(c[0]).includes('INSERT INTO documentos')) ?? [];
    expect(documento[1]).toEqual(expect.arrayContaining(['a.pdf', 'u1', 2]));
    const capitulos = m.tx.query.mock.calls.find((c) => String(c[0]).includes('INSERT INTO capitulos')) ?? [];
    expect(capitulos[1]?.[1]).toBe('u1');
    expect(capitulos[1]?.[4]).toEqual(['Capítulo 1: Uno', 'Capítulo 2: Dos']);
    const [, valores] = insercionesDeFragmentos()[0] ?? [];
    expect(valores?.[4]).toEqual([1]);
    expect(valores?.[5]).toEqual([2]);
    expect(valores?.[6]).toEqual(['1–2']);
    expect(sentencias().some((s) => s.includes('por_indexar = NULL, progreso = NULL'))).toBe(true);
  });

  it('RB-38: sin presupuesto, guarda un lote y deja el resto para después', async () => {
    m.extraerPdf.mockResolvedValue(extraido(paginasPara(25)));
    const r = await indexarContenido('u1', new Uint8Array(1), { nombreArchivo: 'a.pdf' }, { presupuestoMs: -1 });
    expect(r.numFragmentos).toBeGreaterThan(20);
    expect(r.progreso).toBeGreaterThan(0);
    expect(r.progreso).toBeLessThan(100);
    expect(m.generarEmbeddings).toHaveBeenCalledTimes(1);
    expect((m.generarEmbeddings.mock.calls[0]?.[0] as string[]).length).toBe(20);
    expect(sentencias().some((s) => s.includes('SET por_indexar = $2::jsonb'))).toBe(true);
    expect(m.consultar.mock.calls.some((c) => String(c[0]).includes('indexando_hasta = NULL'))).toBe(true);
  });

  it('si Gemini falla antes de guardar nada, no queda un documento a medias', async () => {
    m.generarEmbeddings.mockRejectedValue(new ErrorDeNegocio('ERROR_LLM'));
    await expect(indexarContenido('u1', new Uint8Array(1), { nombreArchivo: 'a.pdf' })).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
    expect(m.consultar.mock.calls.some((c) => String(c[0]).startsWith('DELETE FROM documentos') && c[1]?.[0] === 'doc-1')).toBe(true);
  });

  it('si Gemini se queda sin cuota tras guardar un lote, conserva lo hecho y se puede seguir', async () => {
    m.extraerPdf.mockResolvedValue(extraido(paginasPara(25)));
    m.generarEmbeddings.mockImplementationOnce(async (t: string[]) => t.map(() => [0.1])).mockRejectedValueOnce(new ErrorDeNegocio('ERROR_LLM'));
    const r = await indexarContenido('u1', new Uint8Array(1), { nombreArchivo: 'a.pdf' });
    expect(r.progreso).toBeGreaterThan(0);
    expect(m.consultar.mock.calls.some((c) => String(c[0]).startsWith('DELETE FROM documentos'))).toBe(false);
  });
});

describe('continuarIndexacion (RB-38)', () => {
  const U = 'u1';
  beforeEach(() => {
    vi.resetAllMocks();
    m.generarEmbeddings.mockImplementation(async (textos: string[]) => textos.map(() => [0.1]));
    m.tx.query.mockImplementation(async () => ({ rows: [{ id: 'd' }] }));
    m.conTransaccion.mockImplementation((trabajo: (tx: typeof m.tx) => unknown) => trabajo(m.tx));
  });
  const pendiente = (numero: number) => ({ numero, contenido: `t${numero}`, paginaInicio: 1, paginaFin: 1, etiquetaPaginas: '1' });

  it('toma el documento solo si es del usuario y nadie más lo indexa, y termina', async () => {
    m.consultar.mockResolvedValueOnce([{ por_indexar: [pendiente(21), pendiente(22)] }]).mockResolvedValue([]);
    await expect(continuarIndexacion(U, 'd')).resolves.toEqual({ progreso: null });
    const [sql, valores] = m.consultar.mock.calls[0] ?? [];
    expect(String(sql)).toContain('usuario_id = $2');
    expect(String(sql)).toContain('indexando_hasta IS NULL OR indexando_hasta < NOW()');
    expect(valores?.slice(0, 2)).toEqual(['d', U]);
    const [, datos] = m.tx.query.mock.calls.find((c) => String(c[0]).includes('num_fragmentos = $2')) ?? [];
    expect(datos).toEqual(['d', 22]); // cuenta también los ya guardados
  });

  it('con otra llamada en curso responde ocupado, sin gastar cuota', async () => {
    m.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ progreso: 40 }]);
    await expect(continuarIndexacion(U, 'd')).resolves.toEqual({ progreso: 40, ocupado: true });
    expect(m.generarEmbeddings).not.toHaveBeenCalled();
  });

  it('terminado: progreso null; de otro usuario o inexistente: no encontrado', async () => {
    m.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ progreso: null }]);
    await expect(continuarIndexacion(U, 'd')).resolves.toEqual({ progreso: null });
    m.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(continuarIndexacion(U, 'd')).rejects.toMatchObject({ codigo: 'DOCUMENTO_NO_ENCONTRADO' });
  });

  it('si lo eliminaron mientras se indexaba, se detiene sin guardar', async () => {
    m.consultar.mockResolvedValueOnce([{ por_indexar: [pendiente(1)] }]).mockResolvedValue([]);
    m.tx.query.mockImplementation(async () => ({ rows: [] }));
    await expect(continuarIndexacion(U, 'd')).resolves.toEqual({ progreso: null });
    expect(insercionesDeFragmentos()).toHaveLength(0);
  });

  it('capítulos: solo los del usuario; ajeno, no encontrado', async () => {
    m.consultar.mockResolvedValueOnce([{ id: 'd', nombreArchivo: 'a.pdf', paginas: 9 }]).mockResolvedValueOnce([{ orden: 1 }]);
    await expect(capitulosDeDocumento(U, 'd')).resolves.toEqual({ documento: { id: 'd', nombreArchivo: 'a.pdf', paginas: 9 }, capitulos: [{ orden: 1 }] });
    expect(m.consultar.mock.calls.every((c) => c[1]?.includes(U))).toBe(true);
    m.consultar.mockResolvedValueOnce([]);
    await expect(capitulosDeDocumento(U, 'x')).rejects.toMatchObject({ codigo: 'DOCUMENTO_NO_ENCONTRADO' });
  });
});
