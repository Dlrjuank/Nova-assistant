// @vitest-environment node
// E11c (5.10): el service worker muestra la notificación, lleva el numerito del ícono y abre la tarea al tocarla.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const ORIGEN = 'https://nova.ejemplo';
type Manejador = (e: unknown) => void;

function entorno(ventanas: Array<{ url: string }> = []) {
  const manejadores: Record<string, Manejador[]> = {};
  const mostradas: Array<{ titulo: string; opciones: Record<string, unknown> }> = [];
  const abiertas: Array<{ url: string; postMessage: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> }> = ventanas.map((v) => ({
    url: v.url,
    postMessage: vi.fn(),
    focus: vi.fn().mockResolvedValue(undefined),
  }));
  const numerito = { setAppBadge: vi.fn().mockResolvedValue(undefined), clearAppBadge: vi.fn().mockResolvedValue(undefined) };
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const self: Record<string, unknown> = {
    location: { origin: ORIGEN },
    navigator: numerito,
    addEventListener: (t: string, f: Manejador) => (manejadores[t] ??= []).push(f),
    skipWaiting: () => undefined,
    registration: {
      showNotification: async (titulo: string, opciones: Record<string, unknown>) => void mostradas.push({ titulo, opciones }),
      getNotifications: async () => mostradas,
    },
    clients: { claim: async () => undefined, matchAll: async () => abiertas, openWindow },
  };
  const importScripts = () => new Function('self', readFileSync(join(process.cwd(), 'public/sw-reglas.js'), 'utf8'))(self);
  new Function('self', 'caches', 'importScripts', 'fetch', 'URL', 'Response', readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8'))(
    self,
    {},
    importScripts,
    vi.fn(),
    URL,
    Response,
  );
  async function disparar(tipo: string, evento: Record<string, unknown>) {
    const pendientes: Promise<unknown>[] = [];
    for (const f of manejadores[tipo] ?? []) f({ ...evento, waitUntil: (p: Promise<unknown>) => pendientes.push(p) });
    await Promise.all(pendientes);
  }
  const push = (datos: unknown) => disparar('push', { data: { json: () => datos, text: () => JSON.stringify(datos) } });
  const tocar = (url: unknown) => disparar('notificationclick', { notification: { data: { url }, close: vi.fn() } });
  return { push, tocar, mostradas, abiertas, numerito, openWindow };
}

describe('service worker: notificaciones (E11c)', () => {
  it('muestra la notificación con su texto y el ícono de Nova, y el numerito cuenta las que no se abrieron', async () => {
    const sw = entorno();
    await sw.push({ titulo: 'Nova', cuerpo: 'En 15 min: Clase (10:00 – 11:00)', url: '/nova/tareas?tarea=t1', etiqueta: 'tarea-t1' });
    await sw.push({ titulo: 'Nova', cuerpo: 'Hoy: Pagar', url: '/nova/tareas?tarea=t2', etiqueta: 'tarea-t2' });
    expect(sw.mostradas[0]).toEqual({
      titulo: 'Nova',
      opciones: expect.objectContaining({ body: 'En 15 min: Clase (10:00 – 11:00)', tag: 'tarea-t1', icon: '/icons/icono-192.png', data: { url: '/nova/tareas?tarea=t1' } }),
    });
    expect(sw.numerito.setAppBadge).toHaveBeenLastCalledWith(2);
  });

  it('una dirección ajena en la carga lleva a Inicio, nunca fuera de Nova', async () => {
    const sw = entorno();
    for (const url of ['https://malo.ejemplo/x', '//malo.ejemplo', '/home', '/novaX', 42]) await sw.push({ titulo: 'Nova', cuerpo: 'x', url });
    expect(sw.mostradas.map((n) => (n.opciones.data as { url: string }).url)).toEqual(['/nova', '/nova', '/nova', '/nova', '/nova']);
  });

  it('al tocarla sin Nova abierta, abre una ventana en la tarea', async () => {
    const sw = entorno();
    await sw.tocar('/nova/tareas?tarea=t1');
    expect(sw.openWindow).toHaveBeenCalledWith('/nova/tareas?tarea=t1');
  });

  it('con Nova abierta, la trae al frente y le pide ir a la tarea sin recargar', async () => {
    const sw = entorno([{ url: `${ORIGEN}/home` }, { url: `${ORIGEN}/nova/calendario` }]);
    await sw.tocar('/nova/tareas?tarea=t1');
    expect(sw.openWindow).not.toHaveBeenCalled();
    expect(sw.abiertas[1]?.postMessage).toHaveBeenCalledWith({ tipo: 'nova-abrir', url: '/nova/tareas?tarea=t1' });
    expect(sw.abiertas[1]?.focus).toHaveBeenCalled();
    expect(sw.abiertas[0]?.postMessage).not.toHaveBeenCalled();
  });
});
