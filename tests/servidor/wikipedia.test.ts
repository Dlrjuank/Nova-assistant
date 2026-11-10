// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  consultarBd: vi.fn(),
  responder: vi.fn(),
  exigirSesion: vi.fn(),
  buscarEnWikipedia: vi.fn(),
}));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultarBd, conTransaccion: vi.fn() }));
vi.mock('@/lib/llm/gemini', () => ({ llm: { responder: m.responder } }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', () => ({ buscarEnWikipedia: m.buscarEnWikipedia }));

import * as webRuta from '@/app/api/nova/web/route';
import { buscarEnWikipedia } from '@/lib/datos/wikipedia';

// Wikipedia devuelve las páginas desordenadas; `index` es la posición en la búsqueda.
const PAGINAS = [
  { title: 'Ciénaga Grande', fullurl: 'https://es.wikipedia.org/wiki/Ci%C3%A9naga_Grande', extract: 'Una ciénaga.', index: 3 },
  { title: 'Sierra Nevada de Santa Marta', fullurl: 'https://es.wikipedia.org/wiki/Sierra_Nevada_de_Santa_Marta', extract: 'Cordillera de Colombia.', index: 1 },
  { title: 'Pico Cristóbal Colón', fullurl: 'https://es.wikipedia.org/wiki/Pico_Crist%C3%B3bal_Col%C3%B3n', extract: 'La montaña más alta.', index: 2 },
];
const wikipedia = (pages: unknown[] | null, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(pages === null ? {} : { query: { pages } }), { status }));

describe('buscarEnWikipedia (CU-06, RB-55)', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('busca y resume los 3 primeros en orden, sin tocar la base', async () => {
    const f = wikipedia(PAGINAS);
    vi.stubGlobal('fetch', f);
    m.responder.mockResolvedValue('La Sierra Nevada es una cordillera.');

    const r = await buscarEnWikipedia('  Sierra   Nevada de Santa Marta ');
    expect(r).toEqual({
      resumen: 'La Sierra Nevada es una cordillera.',
      url: 'https://es.wikipedia.org/wiki/Sierra_Nevada_de_Santa_Marta',
      articulos: [
        { titulo: 'Sierra Nevada de Santa Marta', url: PAGINAS[1]?.fullurl },
        { titulo: 'Pico Cristóbal Colón', url: PAGINAS[2]?.fullurl },
        { titulo: 'Ciénaga Grande', url: PAGINAS[0]?.fullurl },
      ],
    });

    const url = new URL(f.mock.calls[0]?.[0]);
    expect(url.origin + url.pathname).toBe('https://es.wikipedia.org/w/api.php');
    expect(url.searchParams.get('gsrsearch')).toBe('Sierra Nevada de Santa Marta');
    expect(url.searchParams.get('gsrlimit')).toBe('3');
    expect(f.mock.calls[0]?.[1].headers['User-Agent']).toContain('NovaAssistant');

    const llamada = m.responder.mock.calls[0]?.[0];
    expect(llamada.pregunta).toBe('Sierra Nevada de Santa Marta');
    expect(llamada.contexto.indexOf('Sierra Nevada')).toBeLessThan(llamada.contexto.indexOf('Ciénaga'));
    expect(m.consultarBd).not.toHaveBeenCalled();
  });

  it('una pregunta larga se recorta al máximo que admite Wikipedia', async () => {
    const f = wikipedia(PAGINAS);
    vi.stubGlobal('fetch', f);
    m.responder.mockResolvedValue('Resumen.');
    await buscarEnWikipedia(`palabra ${'a'.repeat(500)}`);
    expect(new URL(f.mock.calls[0]?.[0]).searchParams.get('gsrsearch')).toHaveLength(300);
  });

  it('RN-02: una consulta corta no llega a Wikipedia', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(buscarEnWikipedia('Colombia')).rejects.toMatchObject({ codigo: 'CONSULTA_MUY_CORTA' });
    expect(f).not.toHaveBeenCalled();
  });

  it('sin resultados no llama a Gemini', async () => {
    vi.stubGlobal('fetch', wikipedia(null));
    const r = await buscarEnWikipedia('qwertyuiop asdfghjkl');
    expect(r).toMatchObject({ url: '', articulos: [] });
    expect(m.responder).not.toHaveBeenCalled();
  });

  it('si Wikipedia falla o no responde, ERROR_WIKIPEDIA', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const f of [wikipedia([], 503), vi.fn().mockRejectedValue(new Error('timeout'))]) {
      vi.stubGlobal('fetch', f);
      await expect(buscarEnWikipedia('Sierra Nevada')).rejects.toMatchObject({ codigo: 'ERROR_WIKIPEDIA' });
    }
    expect(m.responder).not.toHaveBeenCalled();
  });

  it('si Gemini falla, el error sigue su curso', async () => {
    vi.stubGlobal('fetch', wikipedia(PAGINAS));
    m.responder.mockRejectedValue(new ErrorDeNegocio('ERROR_LLM'));
    await expect(buscarEnWikipedia('Sierra Nevada')).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
  });
});

describe('POST /api/nova/web', () => {
  const post = (cuerpo: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) });
  beforeEach(() => {
    vi.resetAllMocks();
    m.exigirSesion.mockResolvedValue({ id: 'u1', email: 'dueno@ejemplo.com' });
  });

  it('sin sesión o fuera de la lista no busca', async () => {
    for (const [codigo, estado] of [['NO_AUTORIZADO', 401], ['ACCESO_DENEGADO', 403]] as const) {
      m.exigirSesion.mockRejectedValue(new ErrorDeNegocio(codigo));
      expect((await webRuta.POST(post({ consulta: 'Sierra Nevada' }))).status).toBe(estado);
    }
    expect(m.buscarEnWikipedia).not.toHaveBeenCalled();
  });

  it('pasa la consulta; una consulta vacía o muy larga es 400', async () => {
    m.buscarEnWikipedia.mockResolvedValue({ resumen: 'R', url: '', articulos: [] });
    await webRuta.POST(post({ consulta: 'Sierra Nevada' }));
    expect(m.buscarEnWikipedia).toHaveBeenLastCalledWith('Sierra Nevada');
    expect((await webRuta.POST(post({ consulta: '' }))).status).toBe(400);
    expect((await webRuta.POST(post({ consulta: 'a'.repeat(301) }))).status).toBe(400);
    expect(m.buscarEnWikipedia).toHaveBeenCalledTimes(1);
  });
});
