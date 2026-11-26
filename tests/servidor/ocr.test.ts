// @vitest-environment node
// E20d-3: PDF con páginas escaneadas: pregunta, "Leerlas" por grupos, "Ahora no", vencimiento y borrado.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  extraerPdf: vi.fn(),
  generarEmbeddings: vi.fn(),
  leerArchivos: vi.fn(),
  conTransaccion: vi.fn(),
  consultar: vi.fn(),
  del: vi.fn(),
  separar: vi.fn(),
  tx: { query: vi.fn() },
}));
vi.mock('@vercel/blob', () => ({ del: m.del }));
vi.mock('@/lib/pdf/extraer', () => ({ extraerPdf: m.extraerPdf }));
vi.mock('@/lib/llm/gemini', () => ({ llm: { generarEmbeddings: m.generarEmbeddings, leerArchivos: m.leerArchivos } }));
vi.mock('@/lib/db/conexion', () => ({ aLiteralVector: (v: number[]) => `[${v.join(',')}]`, conTransaccion: m.conTransaccion, consultar: m.consultar }));
vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: async () => ({}),
    create: async () => ({ copyPages: async (_: unknown, i: number[]) => (m.separar(i), i), addPage: () => {}, save: async () => new Uint8Array([9]) }),
  },
}));

import { continuarIndexacion, eliminarDocumento, indexarDocumento, responderOcr, vencerPreguntasOcr } from '@/lib/datos/documentos';
import type { LecturaOcr } from '@/lib/reglas/ocr';

const URL_PDF = 'https://x.public.blob.vercel-storage.com/libro-abc.pdf';
const TEXTO = 'Capítulo 1 La fotosíntesis convierte la luz del sol en energía química para la planta';
const lecturaBase = (extra: Partial<LecturaOcr> = {}): LecturaOcr => ({
  ocr: true,
  estado: 'pregunta',
  fuente: 'pdf',
  urls: [URL_PDF],
  textos: [TEXTO, '', ''],
  porLeer: [2, 3],
  leidas: [],
  total: 2,
  etiquetas: null,
  indice: [],
  venceEn: '2026-11-27T00:00:00.000Z',
  ...extra,
});
const sql = () => m.consultar.mock.calls.map((c) => String(c[0]));
const txSql = () => m.tx.query.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  vi.resetAllMocks();
  m.consultar.mockResolvedValue([]);
  m.tx.query.mockResolvedValue({ rows: [{ usuario_id: 'u1', id: 'doc-1' }] });
  m.conTransaccion.mockImplementation((t: (tx: typeof m.tx) => unknown) => t(m.tx));
  m.del.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
});

describe('al subir un PDF con páginas escaneadas', () => {
  it('guarda lo leído y la pregunta, no indexa nada y deja el PDF en Blob', async () => {
    m.extraerPdf.mockResolvedValue({ paginas: [TEXTO, '', ''], etiquetas: null, indice: [], escaneadas: [2, 3] });
    m.consultar.mockResolvedValueOnce([{ id: 'doc-1' }]);
    const r = await indexarDocumento('u1', { urlBlob: URL_PDF, nombreArchivo: 'Libro.pdf' });
    expect(r).toEqual({ documentoId: 'doc-1', numFragmentos: 0, progreso: 0, ocr: { estado: 'pregunta', fuente: 'pdf', total: 2, leidas: 0 } });
    const insercion = m.consultar.mock.calls.find((c) => String(c[0]).includes('INSERT INTO documentos')) ?? [];
    const lectura = JSON.parse((insercion[1] as unknown[])[5] as string) as LecturaOcr;
    expect(lectura).toMatchObject({ ocr: true, estado: 'pregunta', urls: [URL_PDF], porLeer: [2, 3], total: 2 });
    expect(m.generarEmbeddings).not.toHaveBeenCalled();
    expect(m.leerArchivos).not.toHaveBeenCalled();
    expect(m.del).not.toHaveBeenCalled();
  });

  it('más de 300 páginas escaneadas se rechaza y el PDF se borra', async () => {
    m.extraerPdf.mockResolvedValue({ paginas: Array(301).fill(''), etiquetas: null, indice: [], escaneadas: Array.from({ length: 301 }, (_, i) => i + 1) });
    await expect(indexarDocumento('u1', { urlBlob: URL_PDF, nombreArchivo: 'Libro.pdf' })).rejects.toMatchObject({
      codigo: 'PDF_MUY_LARGO',
      message: 'El PDF tiene 301 páginas escaneadas; el máximo es 300.',
    });
    expect(m.del).toHaveBeenCalledWith(URL_PDF);
  });
});

describe('la respuesta', () => {
  it('"Leerlas" pasa a leer; mientras espera, continuar no toma el documento', async () => {
    m.consultar.mockResolvedValueOnce([{ por_indexar: lecturaBase(), progreso: 0 }]);
    await expect(responderOcr('u1', 'doc-1', true)).resolves.toMatchObject({ progreso: 0, ocr: { estado: 'leyendo' } });
    expect(sql().some((s) => s.includes(`jsonb_set(por_indexar, '{estado}', '"leyendo"')`))).toBe(true);

    m.consultar.mockReset();
    m.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ progreso: 0, por_indexar: lecturaBase() }]);
    await expect(continuarIndexacion('u1', 'doc-1')).resolves.toMatchObject({ ocr: { estado: 'pregunta' } });
    expect(sql()[0]).toContain("por_indexar->>'estado' = 'pregunta'");
    expect(m.leerArchivos).not.toHaveBeenCalled();
  });

  it('"Ahora no" indexa solo lo que tenía texto, como un PDF normal, y borra el PDF', async () => {
    m.consultar.mockResolvedValueOnce([{ por_indexar: lecturaBase(), progreso: 0 }]);
    await expect(responderOcr('u1', 'doc-1', false)).resolves.toEqual({ progreso: 0 });
    const actualizacion = m.tx.query.mock.calls.find((c) => String(c[0]).startsWith('UPDATE documentos SET por_indexar')) ?? [];
    const fragmentos = JSON.parse((actualizacion[1] as unknown[])[1] as string) as Array<{ ocr?: boolean; paginaInicio: number }>;
    expect(fragmentos).toHaveLength(1);
    expect(fragmentos[0]?.ocr).toBeUndefined();
    expect((actualizacion[1] as unknown[])[4]).toBe('pdf');
    expect(txSql().some((s) => s.includes('INSERT INTO capitulos'))).toBe(false); // un solo capítulo no alcanza
    expect(m.del).toHaveBeenCalledWith(URL_PDF);
  });

  it('"Ahora no" con todo escaneado: no queda nada, el documento se borra', async () => {
    m.consultar.mockResolvedValueOnce([{ por_indexar: lecturaBase({ textos: ['', ''], porLeer: [1, 2] }), progreso: 0 }]).mockResolvedValueOnce([{ id: 'doc-1' }]);
    await expect(responderOcr('u1', 'doc-1', false)).resolves.toEqual({ progreso: null, eliminado: true });
    expect(sql().some((s) => s.startsWith('DELETE FROM documentos'))).toBe(true);
    expect(m.del).toHaveBeenCalledWith(URL_PDF);
  });

  it('un documento ajeno responde como inexistente', async () => {
    await expect(responderOcr('u2', 'doc-1', true)).rejects.toMatchObject({ codigo: 'DOCUMENTO_NO_ENCONTRADO' });
  });
});

describe('leer por grupos', () => {
  it('lee un grupo con Gemini y guarda lo leído; con el último, arma los fragmentos marcados y lo deja como escaneado', async () => {
    m.leerArchivos.mockResolvedValue({ paginas: [{ pagina: 1, texto: 'Texto de la página dos' }, { pagina: 2, texto: 'Texto de la página tres' }] });
    m.consultar.mockResolvedValueOnce([{ por_indexar: lecturaBase({ estado: 'leyendo' }) }]);
    await expect(continuarIndexacion('u1', 'doc-1')).resolves.toEqual({ progreso: 0 });
    expect(m.separar).toHaveBeenCalledWith([1, 2]); // páginas 2 y 3, desde cero
    const pedido = m.leerArchivos.mock.calls[0]?.[0] as { archivos: Array<{ mimeType: string }>; pedido: string };
    expect(pedido.archivos[0]?.mimeType).toBe('application/pdf');
    expect(pedido.pedido).toContain('2 páginas');
    const actualizacion = m.tx.query.mock.calls.find((c) => String(c[0]).startsWith('UPDATE documentos SET por_indexar')) ?? [];
    const valores = actualizacion[1] as unknown[];
    const fragmentos = JSON.parse(valores[1] as string) as Array<{ ocr?: boolean; contenido: string }>;
    expect(fragmentos[0]?.contenido).toContain('Texto de la página tres');
    expect(fragmentos[0]?.ocr).toBe(true);
    expect(valores[4]).toBe('pdf_escaneado');
    expect(m.del).toHaveBeenCalledWith(URL_PDF);
  });

  it('si quedan páginas, guarda el avance y suelta el bloqueo; si Gemini falla, también lo suelta', async () => {
    const porLeer = Array.from({ length: 15 }, (_, i) => i + 2);
    m.leerArchivos.mockResolvedValue({ paginas: [] });
    m.consultar.mockResolvedValueOnce([{ por_indexar: lecturaBase({ estado: 'leyendo', textos: Array(16).fill(''), porLeer, total: 15 }) }]);
    await expect(continuarIndexacion('u1', 'doc-1')).resolves.toEqual({ progreso: 0, ocr: { estado: 'leyendo', fuente: 'pdf', total: 15, leidas: 10 } });
    const guardado = m.consultar.mock.calls.find((c) => String(c[0]).includes('indexando_hasta = NULL WHERE id = $1 AND')) ?? [];
    expect((JSON.parse((guardado[1] as unknown[])[1] as string) as LecturaOcr).porLeer).toEqual([12, 13, 14, 15, 16]);

    m.consultar.mockReset();
    m.consultar.mockResolvedValueOnce([{ por_indexar: lecturaBase({ estado: 'leyendo' }) }]).mockResolvedValue([]);
    m.leerArchivos.mockRejectedValue(Object.assign(new Error('sin cuota'), { codigo: 'CUOTA_CLAVE_AGOTADA' }));
    await expect(continuarIndexacion('u1', 'doc-1')).rejects.toThrow('sin cuota');
    // Suelta el bloqueo (la pantalla puede reintentar enseguida) y cuenta el fallo.
    expect(sql().some((s) => s.includes('indexando_hasta = NULL WHERE id = $1 AND'))).toBe(true);
  });
});

describe('vencer y borrar', () => {
  it('una pregunta sin respuesta en 24 horas se toma como "Ahora no"', async () => {
    m.consultar.mockResolvedValueOnce([{ id: 'doc-1', por_indexar: lecturaBase() }]);
    await expect(vencerPreguntasOcr()).resolves.toBe(1);
    expect(sql()[0]).toContain("(por_indexar->>'venceEn')::timestamptz < NOW()");
    expect(m.del).toHaveBeenCalledWith(URL_PDF);
  });

  it('eliminar un documento que esperaba el OCR borra su PDF de Blob', async () => {
    m.consultar.mockResolvedValueOnce([{ id: 'doc-1', por_indexar: lecturaBase() }]);
    await eliminarDocumento('u1', 'doc-1');
    expect(m.del).toHaveBeenCalledWith(URL_PDF);
  });
});

describe('correcciones de la revisión', () => {
  it('un fallo que no es de cuota se cuenta y, en segundo plano, el documento espera 10 minutos', async () => {
    m.leerArchivos.mockRejectedValue(new Error('el modelo no contestó'));
    m.consultar.mockResolvedValueOnce([{ por_indexar: lecturaBase({ estado: 'leyendo', fallos: 1 }) }]).mockResolvedValue([]);
    await expect(continuarIndexacion('u1', 'doc-1')).rejects.toThrow('no contestó');
    const guardado = m.consultar.mock.calls.find((c) => String(c[0]).includes('SET por_indexar = $2::jsonb, indexando_hasta = NULL')) ?? [];
    expect((JSON.parse((guardado[1] as unknown[])[1] as string) as LecturaOcr).fallos).toBe(2);
  });

  it('al quinto fallo seguido, o si el archivo ya no se puede leer, termina con lo leído', async () => {
    m.leerArchivos.mockRejectedValue(new Error('otra vez'));
    m.consultar.mockResolvedValueOnce([{ por_indexar: lecturaBase({ estado: 'leyendo', fallos: 4 }) }]);
    await expect(continuarIndexacion('u1', 'doc-1')).resolves.toEqual({ progreso: 0 });
    expect(m.del).toHaveBeenCalledWith(URL_PDF);

    m.del.mockClear();
    m.consultar.mockReset();
    m.consultar.mockResolvedValueOnce([{ por_indexar: lecturaBase({ estado: 'leyendo' }) }]).mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 404 })));
    await expect(continuarIndexacion('u1', 'doc-1')).resolves.toEqual({ progreso: 0 });
    expect(m.leerArchivos).toHaveBeenCalledTimes(1); // solo el intento anterior
    expect(m.del).toHaveBeenCalledWith(URL_PDF);
  });

  it('"Ahora no" no corta una lectura que otra pestaña ya empezó', async () => {
    m.consultar.mockResolvedValueOnce([{ por_indexar: lecturaBase(), progreso: 0 }]);
    m.tx.query.mockResolvedValue({ rows: [] }); // ya no está en 'pregunta'
    await expect(responderOcr('u1', 'doc-1', false)).resolves.toEqual({ progreso: 0 });
    expect(txSql()[0]).toContain("por_indexar->>'estado' = 'pregunta'");
    expect(m.del).not.toHaveBeenCalled();
  });

  it('el vencimiento también cubre una lectura que no avanza en 7 días', async () => {
    await vencerPreguntasOcr();
    expect(sql()[0]).toContain("por_indexar->>'estado' = 'leyendo'");
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([7]);
  });
});
