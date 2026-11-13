// @vitest-environment node
// E11c: rutas de notificaciones y el aviso de cada minuto.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  exigirSesion: vi.fn(),
  procesarRecordatorios: vi.fn(),
  avanzarLibroEnSegundoPlano: vi.fn(),
  guardarSuscripcion: vi.fn(),
  borrarSuscripcion: vi.fn(),
  contarSuscripciones: vi.fn(),
  clavePublicaPush: vi.fn(),
  enviarPrueba: vi.fn(),
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', () => m);

import * as rutaNotificaciones from '@/app/api/nova/notificaciones/route';
import * as rutaTick from '@/app/api/nova/recordatorios/tick/route';

const U = '11111111-1111-4111-8111-111111111111';
const tick = (secreto?: string) =>
  rutaTick.POST(new Request('http://x/api/nova/recordatorios/tick', { method: 'POST', headers: secreto ? { 'x-nova-tick': secreto } : {} }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('RECORDATORIOS_SECRETO', 'secreto-de-prueba-largo');
  m.exigirSesion.mockResolvedValue({ id: U, email: 'yo@ejemplo.com' });
  m.procesarRecordatorios.mockResolvedValue({ enviados: 1, omitidos: 0, sinDispositivo: 0 });
  m.avanzarLibroEnSegundoPlano.mockResolvedValue(null);
});

describe('POST /api/nova/recordatorios/tick', () => {
  it('sin el secreto, o con otro, 401 y no hace nada', async () => {
    for (const r of [await tick(), await tick('otro'), await tick('secreto-de-prueba-largX')]) expect(r.status).toBe(401);
    expect(m.procesarRecordatorios).not.toHaveBeenCalled();
    expect(m.avanzarLibroEnSegundoPlano).not.toHaveBeenCalled();
  });

  it('sin RECORDATORIOS_SECRETO en el servidor, nadie entra', async () => {
    vi.stubEnv('RECORDATORIOS_SECRETO', '');
    expect((await tick('')).status).toBe(401);
  });

  it('con el secreto envía los recordatorios y avanza un libro', async () => {
    const r = await tick('secreto-de-prueba-largo');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, recordatorios: { enviados: 1, omitidos: 0, sinDispositivo: 0 }, libro: null });
  });

  it('un fallo en el libro no impide los recordatorios', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.avanzarLibroEnSegundoPlano.mockRejectedValue(new Error('se cayó'));
    const cuerpo = await (await tick('secreto-de-prueba-largo')).json();
    expect(cuerpo).toMatchObject({ ok: false, recordatorios: { enviados: 1 }, libro: null });
  });
});

describe('/api/nova/notificaciones', () => {
  it('GET da la clave pública y cuántos dispositivos tiene el usuario', async () => {
    m.clavePublicaPush.mockReturnValue('BPub');
    m.contarSuscripciones.mockResolvedValue(2);
    const r = await rutaNotificaciones.GET();
    expect(await r.json()).toMatchObject({ ok: true, datos: { clavePublica: 'BPub', suscripciones: 2 } });
    expect(m.contarSuscripciones).toHaveBeenCalledWith(U);
  });

  it('POST guarda la suscripción del navegador a nombre de la sesión', async () => {
    m.guardarSuscripcion.mockResolvedValue({ suscripciones: 1 });
    const cuerpo = { endpoint: 'https://push.ejemplo/1', expirationTime: null, keys: { p256dh: 'p', auth: 'a' }, dispositivo: 'iPhone' };
    const r = await rutaNotificaciones.POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }));
    expect(r.status).toBe(201);
    expect(m.guardarSuscripcion).toHaveBeenCalledWith(U, expect.objectContaining({ endpoint: 'https://push.ejemplo/1', keys: { p256dh: 'p', auth: 'a' }, dispositivo: 'iPhone' }));
  });

  it('POST sin claves válidas se rechaza antes de tocar la base', async () => {
    const r = await rutaNotificaciones.POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: 'no-es-url', keys: {} }) }));
    expect(r.status).toBe(400);
    expect(m.guardarSuscripcion).not.toHaveBeenCalled();
  });

  it('sin sesión, 401', async () => {
    const { ErrorDeNegocio } = await import('@/lib/reglas/errores');
    m.exigirSesion.mockRejectedValue(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await rutaNotificaciones.GET()).status).toBe(401);
  });
});
