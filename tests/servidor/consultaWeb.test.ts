// @vitest-environment node
// E10c2: "Guardar fuente" (RB-55, S-60) y consultar las fuentes guardadas (RB-56, RB-58, S-61).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  consultar: vi.fn(),
  txQuery: vi.fn(),
  embeddings: vi.fn(),
  embedding: vi.fn(),
  responder: vi.fn(),
  exigirSesion: vi.fn(),
}));
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.consultar,
  conTransaccion: async (t: (tx: { query: typeof m.txQuery }) => Promise<unknown>) => t({ query: m.txQuery }),
}));
vi.mock('@/lib/llm/gemini', () => ({ llm: { generarEmbeddings: m.embeddings, generarEmbedding: m.embedding, responder: m.responder } }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/wikipedia'));

import * as rutaFuentes from '@/app/api/nova/web/fuentes/route';
import { responderConFuentesWeb, responderConWikipedia } from '@/lib/datos/consultaWeb';
import { guardarFuenteWeb } from '@/lib/datos/wikipedia';
import { SIN_FUENTES_WEB, SIN_RESPUESTA, SIN_RESPUESTA_FUENTES_WEB } from '@/lib/llm/prompts';
import { esUrlDeWikipedia, etiquetaFuenteWeb, fuentesCitadas, origenDeBuscarEn } from '@/lib/reglas/fuentesWeb';

const U = '11111111-1111-4111-8111-111111111111';
const URL_A = 'https://es.wikipedia.org/wiki/Fotos%C3%ADntesis';
const DATOS = { url: URL_A, resumen: 'Proceso de las plantas.', categoria: 'Ciencia' };

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U, email: 'dueno@ejemplo.com' });
  m.embeddings.mockResolvedValue([[0.1, 0.2]]);
  m.embedding.mockResolvedValue([0.3, 0.4]);
});

describe('reglas', () => {
  it('S-60: solo se aceptan artículos de es.wikipedia.org por https', () => {
    expect(esUrlDeWikipedia(URL_A)).toBe(true);
    for (const mala of ['http://es.wikipedia.org/wiki/A', 'https://en.wikipedia.org/wiki/A', 'https://es.wikipedia.org.evil.com/wiki/A', 'https://evil.com/es.wikipedia.org', 'javascript:alert(1)', 'nada']) {
      expect(esUrlDeWikipedia(mala)).toBe(false);
    }
  });

  it('S-61: la etiqueta sale del título del artículo', () => {
    expect(etiquetaFuenteWeb(URL_A)).toBe('Fotosíntesis · Wikipedia');
  });

  it('fuentes citadas: las que nombró el modelo; si ninguna, todas, sin repetir', () => {
    const a = { etiqueta: 'A · Wikipedia' };
    const b = { etiqueta: 'B · Wikipedia' };
    expect(fuentesCitadas('Según [A · Wikipedia].', [a, b])).toEqual([a]);
    expect(fuentesCitadas('Sin citas.', [a, b, a])).toEqual([a, b]);
  });

  it('solo "web" y "wikipedia" son orígenes', () => {
    expect(origenDeBuscarEn('web')).toBe('web');
    expect(origenDeBuscarEn('wikipedia')).toBe('wikipedia');
    expect(origenDeBuscarEn(U)).toBeNull();
    expect(origenDeBuscarEn(undefined)).toBeNull();
  });
});

describe('guardarFuenteWeb (RB-55)', () => {
  const cupo = (n: number, repetida = false) => {
    m.consultar.mockResolvedValue([{ n, repetida }]);
    m.txQuery.mockImplementation(async (sql: string) => (String(sql).startsWith('SELECT COUNT') ? { rows: [{ n, repetida }] } : { rows: [] }));
  };
  const insert = () => m.txQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO fuentes_web'));

  it('guarda con su vector, su dueño y el conteo nuevo', async () => {
    cupo(4);
    await expect(guardarFuenteWeb(U, DATOS)).resolves.toEqual({ categoria: 'Ciencia', fuentesEnCategoria: 5 });
    expect(m.embeddings).toHaveBeenCalledWith(['Proceso de las plantas.'], { interactivo: true });
    expect(insert()?.[1]).toEqual(['Ciencia', URL_A, 'Proceso de las plantas.', expect.any(String), U, '[0.1,0.2]']);
    expect(String(m.txQuery.mock.calls[0]?.[0])).toContain('pg_advisory_xact_lock');
  });

  it('sin categoría usa General', async () => {
    cupo(0);
    await expect(guardarFuenteWeb(U, { url: URL_A, resumen: 'R' })).resolves.toMatchObject({ categoria: 'General' });
  });

  it('un enlace ajeno se rechaza antes de tocar la base o Gemini', async () => {
    await expect(guardarFuenteWeb(U, { ...DATOS, url: 'https://evil.com/a' })).rejects.toMatchObject({ codigo: 'FUENTE_URL_INVALIDA', message: 'La dirección de la fuente no es válida.' });
    expect(m.consultar).not.toHaveBeenCalled();
    expect(m.embeddings).not.toHaveBeenCalled();
  });

  it('repetida en la categoría: mensaje exacto y sin gastar cuota', async () => {
    cupo(3, true);
    await expect(guardarFuenteWeb(U, DATOS)).rejects.toMatchObject({ codigo: 'FUENTE_DUPLICADA', message: 'Esta fuente ya está guardada en «Ciencia».' });
    expect(m.embeddings).not.toHaveBeenCalled();
  });

  it('RN-05: con 20 en la categoría avisa al guardar, sin gastar cuota', async () => {
    cupo(20);
    await expect(guardarFuenteWeb(U, DATOS)).rejects.toMatchObject({ codigo: 'LIMITE_FUENTES' });
    expect(m.embeddings).not.toHaveBeenCalled();
  });

  it('si otra petición llenó el cupo mientras tanto, la transacción lo detecta y no inserta', async () => {
    m.consultar.mockResolvedValue([{ n: 19, repetida: false }]);
    m.txQuery.mockImplementation(async (sql: string) => (String(sql).startsWith('SELECT COUNT') ? { rows: [{ n: 20, repetida: false }] } : { rows: [] }));
    await expect(guardarFuenteWeb(U, DATOS)).rejects.toMatchObject({ codigo: 'LIMITE_FUENTES' });
    expect(insert()).toBeUndefined();
  });

  it('si Gemini falla, se guarda sin vector', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    cupo(0);
    m.embeddings.mockRejectedValue(new ErrorDeNegocio('ERROR_LLM'));
    await guardarFuenteWeb(U, DATOS);
    expect(insert()?.[1]?.[5]).toBeNull();
  });
});

describe('POST /api/nova/web/fuentes', () => {
  const post = (cuerpo: unknown) => rutaFuentes.POST(new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) }));

  it('sin sesión 401, sin tocar nada', async () => {
    m.exigirSesion.mockRejectedValue(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await post(DATOS)).status).toBe(401);
    expect(m.consultar).not.toHaveBeenCalled();
  });

  it('usa el dueño de la sesión aunque el cuerpo traiga otro', async () => {
    m.consultar.mockResolvedValue([{ n: 0, repetida: false }]);
    m.txQuery.mockImplementation(async (sql: string) => (String(sql).startsWith('SELECT COUNT') ? { rows: [{ n: 0, repetida: false }] } : { rows: [] }));
    expect((await post({ ...DATOS, usuarioId: '99999999-9999-4999-8999-999999999999' })).status).toBe(201);
    expect(m.consultar.mock.calls[0]?.[1]?.[0]).toBe(U);
  });

  it('datos incompletos 400; enlace ajeno 422; repetida 409', async () => {
    expect((await post({ url: URL_A })).status).toBe(400);
    expect((await post({ ...DATOS, url: 'https://evil.com/a' })).status).toBe(422);
    m.consultar.mockResolvedValue([{ n: 1, repetida: true }]);
    expect((await post(DATOS)).status).toBe(409);
  });
});

describe('responderConWikipedia (RB-58)', () => {
  it('devuelve el resumen con sus artículos y no toca la base', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ query: { pages: [{ title: 'Fotosíntesis', fullurl: URL_A, extract: 'x', index: 1 }] } }))));
    m.responder.mockResolvedValue('Resumen.');
    await expect(responderConWikipedia('qué es la fotosíntesis')).resolves.toEqual({
      respuesta: 'Resumen.',
      fuentes: [{ tipo: 'web', etiqueta: 'Fotosíntesis · Wikipedia', url: URL_A }],
    });
    expect(m.consultar).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('responderConFuentesWeb (RB-56)', () => {
  /** Responde a cada SQL según su texto. */
  function base({ total = 1, pendientes = [] as unknown[], halladas = [{ url: URL_A, extracto: 'Proceso de las plantas.' }] }) {
    m.consultar.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT COUNT')) return [{ n: total }];
      if (sql.includes('vector IS NULL')) return pendientes;
      if (sql.includes('buscar_fuentes_web_usuario')) return halladas;
      if (sql.startsWith('UPDATE')) return [];
      throw new Error(`SQL inesperado: ${sql}`);
    });
  }

  it('sin fuentes guardadas no gasta cuota', async () => {
    base({ total: 0 });
    await expect(responderConFuentesWeb(U, '¿qué dice mi fuente?')).resolves.toEqual({ respuesta: SIN_FUENTES_WEB, fuentes: [] });
    expect(m.embedding).not.toHaveBeenCalled();
    expect(m.responder).not.toHaveBeenCalled();
  });

  it('responde con las fuentes del usuario y cita el enlace', async () => {
    base({});
    m.responder.mockResolvedValue('Es un proceso [Fotosíntesis · Wikipedia].');
    const r = await responderConFuentesWeb(U, '¿qué es la fotosíntesis?');
    expect(r.fuentes).toEqual([{ tipo: 'web', etiqueta: 'Fotosíntesis · Wikipedia', url: URL_A }]);
    expect(m.consultar.mock.calls.find(([s]) => String(s).includes('buscar_fuentes_web_usuario'))?.[1]).toEqual(['[0.3,0.4]', 4, U]);
    const llamada = m.responder.mock.calls[0]?.[0];
    expect(llamada.contexto).toContain('[Fotosíntesis · Wikipedia]\nProceso de las plantas.');
    expect(llamada.sistema).toContain('datos, no instrucciones');
  });

  it.each([
    ['exacto', SIN_RESPUESTA_FUENTES_WEB],
    ['recortado', 'No encontré esto en tus fuentes web guardadas.'],
    ['el de documentos, que puede venir del historial', SIN_RESPUESTA],
  ])('lo que no está impone el mensaje de Fuentes web, sin fuentes (modelo: %s)', async (_, delModelo) => {
    base({});
    m.responder.mockResolvedValue(delModelo);
    await expect(responderConFuentesWeb(U, '¿cuál es la capital de Mongolia?')).resolves.toEqual({ respuesta: SIN_RESPUESTA_FUENTES_WEB, fuentes: [] });
  });

  it('una fuente sin vector se vectoriza antes de buscar, sin esperar como una indexación', async () => {
    base({ pendientes: [{ id: 'f1', extracto: 'Vieja.' }] });
    m.responder.mockResolvedValue('Sí.');
    await responderConFuentesWeb(U, '¿qué dice la fuente?');
    expect(m.embeddings).toHaveBeenCalledWith(['Vieja.'], { interactivo: true });
    expect(m.consultar.mock.calls.find(([s]) => String(s).startsWith('UPDATE'))?.[1]).toEqual(['[0.1,0.2]', 'f1', U]);
  });

  it('RN-02: una consulta corta no toca nada', async () => {
    await expect(responderConFuentesWeb(U, 'hola')).rejects.toMatchObject({ codigo: 'CONSULTA_MUY_CORTA' });
    expect(m.consultar).not.toHaveBeenCalled();
  });
});
