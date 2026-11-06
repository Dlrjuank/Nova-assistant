// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  consultarBd: vi.fn(),
  responder: vi.fn(),
  exigirSesion: vi.fn(),
  buscarEnWikipedia: vi.fn(),
}));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultarBd }));
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

/** Responde a cada SQL según su texto. */
function base(enCategoria: number, insertaFila = true) {
  m.consultarBd.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT COUNT')) return [{ n: enCategoria }];
    if (sql.includes('INSERT INTO fuentes_web')) {
      if (!insertaFila) return [];
      enCategoria += 1;
      return [{ id: 'f1' }];
    }
    throw new Error(`SQL inesperado: ${sql}`);
  });
}

describe('buscarEnWikipedia (CU-06)', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('busca, resume los 3 primeros en orden, guarda la URL del primero y devuelve el conteo', async () => {
    const f = wikipedia(PAGINAS);
    vi.stubGlobal('fetch', f);
    base(4);
    m.responder.mockResolvedValue('La Sierra Nevada es una cordillera.');

    const r = await buscarEnWikipedia('u1', '  Sierra   Nevada de Santa Marta ', 'Viajes');
    expect(r).toEqual({
      resumen: 'La Sierra Nevada es una cordillera.',
      url: 'https://es.wikipedia.org/wiki/Sierra_Nevada_de_Santa_Marta',
      guardada: true,
      categoria: 'Viajes',
      articulos: [
        { titulo: 'Sierra Nevada de Santa Marta', url: PAGINAS[1]?.fullurl },
        { titulo: 'Pico Cristóbal Colón', url: PAGINAS[2]?.fullurl },
        { titulo: 'Ciénaga Grande', url: PAGINAS[0]?.fullurl },
      ],
      fuentesEnCategoria: 5,
    });

    const url = new URL(f.mock.calls[0]?.[0]);
    expect(url.origin + url.pathname).toBe('https://es.wikipedia.org/w/api.php');
    expect(url.searchParams.get('gsrsearch')).toBe('Sierra Nevada de Santa Marta');
    expect(url.searchParams.get('gsrlimit')).toBe('3');
    expect(f.mock.calls[0]?.[1].headers['User-Agent']).toContain('NovaAssistant');

    const llamada = m.responder.mock.calls[0]?.[0];
    expect(llamada.pregunta).toBe('Sierra Nevada de Santa Marta');
    expect(llamada.contexto.indexOf('Sierra Nevada')).toBeLessThan(llamada.contexto.indexOf('Ciénaga'));

    const insertar = m.consultarBd.mock.calls.find(([sql]) => String(sql).includes('INSERT'));
    expect(insertar?.[1]).toEqual(['Viajes', PAGINAS[1]?.fullurl, 'La Sierra Nevada es una cordillera.', expect.any(String), 20, 'u1']);
  });

  it('sin categoría usa "General"', async () => {
    vi.stubGlobal('fetch', wikipedia(PAGINAS));
    base(0);
    m.responder.mockResolvedValue('Resumen.');
    expect((await buscarEnWikipedia('u1', 'Sierra Nevada')).categoria).toBe('General');
  });

  it('RN-02: una consulta corta no llega a Wikipedia', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(buscarEnWikipedia('u1', 'Colombia')).rejects.toMatchObject({ codigo: 'CONSULTA_MUY_CORTA' });
    expect(f).not.toHaveBeenCalled();
  });

  it('RN-05: con 20 fuentes en la categoría responde LIMITE_FUENTES sin llamar a Wikipedia ni a Gemini', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    base(20);
    await expect(buscarEnWikipedia('u1', 'Sierra Nevada', 'Viajes')).rejects.toMatchObject({ codigo: 'LIMITE_FUENTES' });
    expect(f).not.toHaveBeenCalled();
    expect(m.responder).not.toHaveBeenCalled();
  });

  it('RN-05: si otra búsqueda llenó el cupo mientras tanto, el INSERT condicionado no guarda y responde LIMITE_FUENTES', async () => {
    vi.stubGlobal('fetch', wikipedia(PAGINAS));
    base(19, false);
    m.responder.mockResolvedValue('Resumen.');
    await expect(buscarEnWikipedia('u1', 'Sierra Nevada', 'Viajes')).rejects.toMatchObject({ codigo: 'LIMITE_FUENTES' });
  });

  it('sin resultados no llama a Gemini ni guarda', async () => {
    vi.stubGlobal('fetch', wikipedia(null));
    base(3);
    const r = await buscarEnWikipedia('u1', 'qwertyuiop asdfghjkl');
    expect(r).toMatchObject({ guardada: false, url: '', articulos: [], fuentesEnCategoria: 3 });
    expect(m.responder).not.toHaveBeenCalled();
    expect(m.consultarBd.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
  });

  it('si Wikipedia falla o no responde, ERROR_WIKIPEDIA y no se guarda nada', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    base(0);
    for (const f of [wikipedia([], 503), vi.fn().mockRejectedValue(new Error('timeout'))]) {
      vi.stubGlobal('fetch', f);
      await expect(buscarEnWikipedia('u1', 'Sierra Nevada')).rejects.toMatchObject({ codigo: 'ERROR_WIKIPEDIA' });
    }
    expect(m.responder).not.toHaveBeenCalled();
  });

  it('si Gemini falla, el error sigue su curso y no se guarda nada', async () => {
    vi.stubGlobal('fetch', wikipedia(PAGINAS));
    base(0);
    m.responder.mockRejectedValue(new ErrorDeNegocio('ERROR_LLM'));
    await expect(buscarEnWikipedia('u1', 'Sierra Nevada')).rejects.toMatchObject({ codigo: 'ERROR_LLM' });
    expect(m.consultarBd.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
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

  it('pasa consulta y categoría; una consulta vacía o muy larga es 400', async () => {
    m.buscarEnWikipedia.mockResolvedValue({ guardada: true });
    await webRuta.POST(post({ consulta: 'Sierra Nevada', categoria: 'Viajes' }));
    expect(m.buscarEnWikipedia).toHaveBeenLastCalledWith('u1', 'Sierra Nevada', 'Viajes');
    expect((await webRuta.POST(post({ consulta: '' }))).status).toBe(400);
    expect((await webRuta.POST(post({ consulta: 'a'.repeat(301) }))).status).toBe(400);
    expect(m.buscarEnWikipedia).toHaveBeenCalledTimes(1);
  });

  it('LIMITE_FUENTES es 409 con el mensaje del plan', async () => {
    m.buscarEnWikipedia.mockRejectedValue(new ErrorDeNegocio('LIMITE_FUENTES'));
    const r = await webRuta.POST(post({ consulta: 'Sierra Nevada' }));
    expect(r.status).toBe(409);
    expect((await r.json()).error.mensaje).toBe('Alcanzó el máximo de 20 fuentes en esta categoría; archive o elimine una.');
  });
});
