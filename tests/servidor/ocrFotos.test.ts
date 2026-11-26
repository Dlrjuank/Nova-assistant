// @vitest-environment node
// E20d-4: fotos como documento, leídas con el OCR de E20d-3.
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

import { continuarIndexacion, indexarDocumento } from '@/lib/datos/documentos';
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

beforeEach(() => {
  vi.resetAllMocks();
  m.consultar.mockResolvedValue([]);
  m.tx.query.mockResolvedValue({ rows: [{ usuario_id: 'u1', id: 'doc-1' }] });
  m.conTransaccion.mockImplementation((t: (tx: typeof m.tx) => unknown) => t(m.tx));
  m.del.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
});

describe('E20d-4: fotos', () => {
  const foto = (n: number, ext = 'jpg') => `https://x.public.blob.vercel-storage.com/foto-${n}.${ext}`;

  it('varias fotos son un solo documento que pregunta antes de leerlas; no se descargan ni se borran todavía', async () => {
    m.consultar.mockResolvedValueOnce([{ id: 'doc-2' }]);
    const r = await indexarDocumento('u1', { urlBlob: foto(1), masUrls: [foto(2, 'png'), foto(3)], nombreArchivo: 'Apuntes de clase' });
    expect(r.ocr).toEqual({ estado: 'pregunta', fuente: 'fotos', total: 3, leidas: 0 });
    const insercion = m.consultar.mock.calls.find((c) => String(c[0]).includes('INSERT INTO documentos')) ?? [];
    const valores = insercion[1] as unknown[];
    expect(valores[0]).toBe('Apuntes de clase');
    expect(valores[7]).toBe('imagen');
    expect((JSON.parse(valores[5] as string) as LecturaOcr).porLeer).toEqual([1, 2, 3]);
    expect(fetch).not.toHaveBeenCalled();
    expect(m.del).not.toHaveBeenCalled();
  });

  it('una foto con un PDF, o más de 30 fotos, se rechaza y todo se borra de Blob', async () => {
    await expect(indexarDocumento('u1', { urlBlob: foto(1), masUrls: [URL_PDF], nombreArchivo: 'x' })).rejects.toMatchObject({ codigo: 'TIPO_NO_ADMITIDO' });
    expect(m.del).toHaveBeenCalledWith(URL_PDF);
    m.del.mockClear();
    await expect(indexarDocumento('u1', { urlBlob: URL_PDF, masUrls: [URL_PDF], nombreArchivo: 'x.pdf' })).rejects.toMatchObject({ codigo: 'TIPO_NO_ADMITIDO' });
    const muchas = Array.from({ length: 30 }, (_, i) => foto(i + 2));
    await expect(indexarDocumento('u1', { urlBlob: foto(1), masUrls: muchas, nombreArchivo: 'x' })).rejects.toMatchObject({ message: 'Puedes subir hasta 30 fotos en un documento.' });
    expect(m.del).toHaveBeenCalledTimes(2 + 31);
  });

  it('las fotos se leen juntas, cada una con su tipo, y el documento queda como Foto', async () => {
    m.leerArchivos.mockResolvedValue({ paginas: [{ pagina: 1, texto: 'Primera foto' }, { pagina: 2, texto: 'Segunda foto' }] });
    const lectura = lecturaBase({ estado: 'leyendo', fuente: 'fotos', urls: [foto(1), foto(2, 'png')], textos: ['', ''], porLeer: [1, 2] });
    m.consultar.mockResolvedValueOnce([{ por_indexar: lectura }]);
    await continuarIndexacion('u1', 'doc-2');
    const pedido = m.leerArchivos.mock.calls[0]?.[0] as { archivos: Array<{ mimeType: string }>; pedido: string };
    expect(pedido.archivos.map((a) => a.mimeType)).toEqual(['image/jpeg', 'image/png']);
    expect(pedido.pedido).toContain('2 fotos');
    const actualizacion = m.tx.query.mock.calls.find((c) => String(c[0]).startsWith('UPDATE documentos SET por_indexar')) ?? [];
    expect((actualizacion[1] as unknown[])[4]).toBe('imagen');
    expect(m.del).toHaveBeenCalledWith(foto(1));
    expect(m.del).toHaveBeenCalledWith(foto(2, 'png'));
  });
});
