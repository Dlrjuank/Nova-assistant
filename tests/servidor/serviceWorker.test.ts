// @vitest-environment node
// E11b (RB-62, RB-63): el service worker completo, con la caché y la red simuladas.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGEN = 'https://nova.ejemplo';
type Manejador = (e: unknown) => void;

/** Un entorno mínimo de service worker: self, caches, clients, importScripts y fetch. */
function entorno() {
  const manejadores: Record<string, Manejador[]> = {};
  const almacen = new Map<string, Map<string, Response>>();
  const clave = (k: string | { url: string }) => new URL(typeof k === 'string' ? k : k.url, ORIGEN).href;
  const abrir = (nombre: string) => {
    if (!almacen.has(nombre)) almacen.set(nombre, new Map());
    const m = almacen.get(nombre) as Map<string, Response>;
    return {
      match: async (k: string | { url: string }) => m.get(clave(k))?.clone(),
      put: async (k: string | { url: string }, r: Response) => void m.set(clave(k), r),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (k: string | { url: string }) => m.delete(clave(k)),
    };
  };
  const caches = {
    open: async (n: string) => abrir(n),
    delete: async (n: string) => almacen.delete(n),
    keys: async () => [...almacen.keys()],
  };
  const mensajes: unknown[] = [];
  const self: Record<string, unknown> = {
    location: { origin: ORIGEN },
    addEventListener: (t: string, f: Manejador) => (manejadores[t] ??= []).push(f),
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined, matchAll: async () => [{ postMessage: (m: unknown) => mensajes.push(m) }] },
  };
  const red = vi.fn<(pedido: unknown) => Promise<Response | Record<string, unknown>>>();
  const importScripts = () => new Function('self', readFileSync(join(process.cwd(), 'public/sw-reglas.js'), 'utf8'))(self);
  new Function('self', 'caches', 'importScripts', 'fetch', 'URL', 'Response', readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8'))(
    self,
    caches,
    importScripts,
    red,
    URL,
    Response,
  );

  /** Despacha un fetch y espera la respuesta y todo lo que quedó pendiente (waitUntil). */
  async function pedir(ruta: string, o: { metodo?: string; modo?: string; encabezados?: Record<string, string> } = {}) {
    const pendientes: Promise<unknown>[] = [];
    let respuesta: Promise<Response> | undefined;
    const evento = {
      request: { url: new URL(ruta, ORIGEN).href, method: o.metodo ?? 'GET', mode: o.modo ?? 'navigate', headers: new Headers(o.encabezados ?? {}) },
      respondWith: (p: Promise<Response>) => (respuesta = p),
      waitUntil: (p: Promise<unknown>) => pendientes.push(p),
    };
    for (const f of manejadores.fetch ?? []) f(evento);
    const r = respuesta ? await respuesta : undefined;
    await Promise.all(pendientes);
    return r;
  }

  /** El aviso de ConexionNova al cambiar de pantalla sin recargar. */
  async function avisarRuta(ruta: string) {
    const pendientes: Promise<unknown>[] = [];
    const evento = { data: { tipo: 'nova-guardar-ruta', url: new URL(ruta, ORIGEN).href }, waitUntil: (p: Promise<unknown>) => pendientes.push(p) };
    for (const f of manejadores.message ?? []) f(evento);
    await Promise.all(pendientes);
  }

  const copias = () => [...(almacen.get('nova-datos-v1')?.keys() ?? [])].map((k) => new URL(k).pathname + new URL(k).search);
  return { red, pedir, avisarRuta, copias, mensajes };
}

const pagina = (cuerpo: string, usuario = 'u1') =>
  new Response(`<html><head><title>Nova</title></head><body>${cuerpo}</body></html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'x-nova-usuario': usuario } });
const sinRed = () => Promise.reject(new TypeError('Failed to fetch'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-13T18:05:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('service worker (RB-62)', () => {
  it('con conexión responde de la red y guarda la copia; sin conexión muestra la copia con su hora', async () => {
    const sw = entorno();
    sw.red.mockResolvedValueOnce(pagina('Mis tareas'));
    const enLinea = await sw.pedir('/nova/tareas?vista=hoy');
    expect(await enLinea?.text()).toContain('Mis tareas');
    expect(sw.copias()).toEqual(expect.arrayContaining(['/nova/tareas?vista=hoy', '/__nova/meta']));
    sw.red.mockImplementation(sinRed);
    const copia = await sw.pedir('/nova/tareas?vista=hoy');
    const html = (await copia?.text()) ?? '';
    expect(html).toContain('Mis tareas');
    expect(html).toContain('<meta name="nova-copia" content="2026-11-13T18:05:00.000Z">');
  });

  it('nunca guarda el Asistente ni la API; sin conexión, el Asistente dice que necesita conexión', async () => {
    const sw = entorno();
    sw.red.mockResolvedValueOnce(pagina('Chat'));
    await sw.pedir('/nova/asistente');
    sw.red.mockResolvedValueOnce(new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } }));
    await sw.pedir('/api/nova/tareas', { modo: 'cors' });
    expect(sw.copias()).toEqual(['/__nova/meta']);
    sw.red.mockImplementation(sinRed);
    const r = await sw.pedir('/nova/asistente');
    expect(r?.status).toBe(503);
    expect(await r?.text()).toContain('Necesitas conexión para esto.');
  });

  it('una pantalla con copia posible que nunca se abrió lo dice', async () => {
    const sw = entorno();
    sw.red.mockResolvedValueOnce(pagina('Inicio'));
    await sw.pedir('/nova');
    sw.red.mockImplementation(sinRed);
    expect(await (await sw.pedir('/nova/calendario'))?.text()).toContain('Esta pantalla aún no está disponible sin conexión.');
    expect(await (await sw.pedir('/nova/calendario?mes=2026-10'))?.text()).toContain('Necesitas conexión para esto.');
  });

  it('los pedidos internos de navegación (RSC) pasan sin tocarse', async () => {
    const sw = entorno();
    expect(await sw.pedir('/nova/tareas?_rsc=1', { modo: 'cors', encabezados: { RSC: '1' } })).toBeUndefined();
    expect(sw.red).not.toHaveBeenCalled();
  });

  it('los archivos estáticos se sirven de la copia la segunda vez', async () => {
    const sw = entorno();
    sw.red.mockResolvedValueOnce(new Response('js', { status: 200 }));
    await sw.pedir('/_next/static/chunks/a.js', { modo: 'no-cors' });
    sw.red.mockImplementation(sinRed);
    expect(await (await sw.pedir('/_next/static/chunks/a.js', { modo: 'no-cors' }))?.text()).toBe('js');
    expect(sw.red).toHaveBeenCalledTimes(1);
  });
});

describe('service worker: navegar con el menú, sin recargar (corrección de E11b)', () => {
  it('al avisar la ruta, pide la página completa y guarda su copia; sin conexión se ve', async () => {
    const sw = entorno();
    sw.red.mockResolvedValueOnce(pagina('Calendario de noviembre'));
    await sw.avisarRuta('/nova/calendario');
    const [url, opciones] = sw.red.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://nova.ejemplo/nova/calendario');
    expect(opciones).toMatchObject({ credentials: 'same-origin', redirect: 'manual' }); // HTML, no RSC
    expect(sw.copias()).toContain('/nova/calendario');
    sw.red.mockImplementation(sinRed);
    expect(await (await sw.pedir('/nova/calendario'))?.text()).toContain('Calendario de noviembre');
  });

  it('con las mismas reglas: el Asistente, otro mes y la API no se piden ni se guardan', async () => {
    const sw = entorno();
    for (const r of ['/nova/asistente', '/nova/calendario?mes=2026-10', '/api/nova/tareas', 'https://otro.sitio/nova']) await sw.avisarRuta(r);
    expect(sw.red).not.toHaveBeenCalled();
    expect(sw.copias()).toEqual([]);
  });

  it('si la sesión fue rechazada (redirección), borra la copia; sin conexión, deja la anterior', async () => {
    const sw = entorno();
    sw.red.mockResolvedValueOnce(pagina('Mis tareas'));
    await sw.avisarRuta('/nova/tareas');
    sw.red.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await sw.avisarRuta('/nova/tareas');
    expect(sw.copias()).toContain('/nova/tareas');
    sw.red.mockResolvedValueOnce({ type: 'opaqueredirect', status: 0, ok: false, headers: new Headers(), clone() { return this; } });
    await sw.avisarRuta('/nova');
    expect(sw.copias()).toEqual([]);
  });
});

describe('service worker: borrar la copia (RB-63)', () => {
  async function conCopia() {
    const sw = entorno();
    sw.red.mockResolvedValueOnce(pagina('Mis tareas'));
    await sw.pedir('/nova/tareas');
    expect(sw.copias()).toContain('/nova/tareas');
    return sw;
  }

  it('al cerrar sesión', async () => {
    const sw = await conCopia();
    sw.red.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await sw.pedir('/api/auth/logout', { metodo: 'POST', modo: 'cors' });
    expect(sw.copias()).toEqual([]);
    expect(sw.mensajes).toEqual([{ tipo: 'nova-copia-borrada', motivo: 'cerro-sesion' }]);
  });

  it('si la API rechaza la sesión, o una página redirige al login', async () => {
    const sw = await conCopia();
    sw.red.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await sw.pedir('/api/nova/semana', { modo: 'cors' });
    expect(sw.copias()).toEqual([]);
    const otro = await conCopia();
    otro.red.mockResolvedValueOnce({ type: 'opaqueredirect', status: 0, ok: false, headers: new Headers(), clone() { return this; } });
    await otro.pedir('/nova');
    expect(otro.copias()).toEqual([]);
  });

  it('si entra otro usuario, su copia empieza de cero', async () => {
    const sw = await conCopia();
    sw.red.mockResolvedValueOnce(pagina('Inicio de otra persona', 'u2'));
    await sw.pedir('/nova');
    expect(sw.copias()).not.toContain('/nova/tareas');
    expect(sw.copias()).toContain('/nova');
  });

  it('tras 7 días sin una respuesta válida del servidor', async () => {
    const sw = await conCopia();
    sw.red.mockImplementation(sinRed);
    vi.setSystemTime(new Date('2026-11-19T18:05:00Z')); // 6 días: todavía se ve
    expect(await (await sw.pedir('/nova/tareas'))?.text()).toContain('Mis tareas');
    vi.setSystemTime(new Date('2026-11-20T18:06:00Z')); // 7 días y un minuto
    expect(await (await sw.pedir('/nova/tareas'))?.text()).toContain('Esta pantalla aún no está disponible sin conexión.');
    expect(sw.copias()).toEqual([]);
  });
});
