// @vitest-environment node
// E20b (commit 6): la ruta de indexar avisa las etapas solo si la pantalla las pide; sin eso, el JSON de siempre.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ exigirSesion: vi.fn(), indexarDocumento: vi.fn() }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', () => ({ indexarDocumento: m.indexarDocumento, listarDocumentos: vi.fn() }));

import { POST } from '@/app/api/nova/documentos/route';
import { estadoEtapa, leerLineas, textoEtapa, TIPO_ETAPAS } from '@/lib/reglas/etapasIndexacion';

const CUERPO = JSON.stringify({ urlBlob: 'https://x.public.blob.vercel-storage.com/a.pdf', nombreArchivo: 'a.pdf' });
const pedir = (accept?: string) =>
  POST(new Request('http://localhost/api/nova/documentos', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(accept ? { Accept: accept } : {}) }, body: CUERPO }));
const lineas = async (r: Response) => (await r.text()).trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: 'u1' });
});

describe('reglas de las etapas', () => {
  it('hechas, en curso, pendientes y la que falló', () => {
    expect(estadoEtapa('subir', 'dividir')).toBe('hecha');
    expect(estadoEtapa('dividir', 'dividir')).toBe('ahora');
    expect(estadoEtapa('guardar', 'dividir')).toBe('pendiente');
    expect(estadoEtapa('dividir', 'dividir', { fallo: true })).toBe('fallo');
    expect(estadoEtapa('guardar', null, { terminado: true })).toBe('hecha');
    expect(textoEtapa('vectores')).toBe('Etapa 4 de 5: Crear los vectores con Gemini');
  });

  it('leerLineas separa las líneas completas y guarda la que llegó a medias', () => {
    expect(leerLineas('{"etapa":"leer"}\n{"eta')).toEqual({ objetos: [{ etapa: 'leer' }], resto: '{"eta' });
  });
});

describe('POST /api/nova/documentos', () => {
  it('sin pedir etapas responde el JSON de siempre (201)', async () => {
    m.indexarDocumento.mockResolvedValue({ documentoId: 'd', numFragmentos: 3, progreso: null });
    const r = await pedir();
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ ok: true, datos: { documentoId: 'd', numFragmentos: 3, progreso: null } });
  });

  it('con etapas: una línea por etapa (sin repetir la de cada lote) y al final el resultado', async () => {
    m.indexarDocumento.mockImplementation(async (_u: string, _d: unknown, o: { alEtapa: (e: string) => void }) => {
      for (const e of ['leer', 'dividir', 'vectores', 'guardar', 'vectores', 'guardar']) o.alEtapa(e);
      return { documentoId: 'd', numFragmentos: 30, progreso: null };
    });
    const r = await pedir(`${TIPO_ETAPAS}, application/json`);
    expect(r.headers.get('content-type')).toContain(TIPO_ETAPAS);
    expect(await lineas(r)).toEqual([
      { etapa: 'leer' },
      { etapa: 'dividir' },
      { etapa: 'vectores' },
      { etapa: 'guardar' },
      { etapa: 'vectores' },
      { etapa: 'guardar' },
      { ok: true, datos: { documentoId: 'd', numFragmentos: 30, progreso: null } },
    ]);
  });

  it('con etapas: un error al leer termina con el mensaje exacto en la última línea', async () => {
    m.indexarDocumento.mockImplementation(async (_u: string, _d: unknown, o: { alEtapa: (e: string) => void }) => {
      o.alEtapa('leer');
      throw new ErrorDeNegocio('PDF_SIN_TEXTO');
    });
    const r = await pedir(TIPO_ETAPAS);
    const [primera, ultima] = await lineas(r);
    expect(primera).toEqual({ etapa: 'leer' });
    expect(ultima).toMatchObject({ ok: false, error: { codigo: 'PDF_SIN_TEXTO' } });
  });

  it('sin sesión responde 401 antes de empezar, aunque pida etapas', async () => {
    m.exigirSesion.mockRejectedValue(new ErrorDeNegocio('NO_AUTORIZADO'));
    const r = await pedir(TIPO_ETAPAS);
    expect(r.status).toBe(401);
    expect(m.indexarDocumento).not.toHaveBeenCalled();
  });
});
