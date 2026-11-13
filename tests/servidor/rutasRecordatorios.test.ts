// @vitest-environment node
// E11c: rutas de notificaciones y el aviso de cada minuto.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  exigirSesion: vi.fn(),
  procesarRecordatorios: vi.fn(),
  procesarResumenes: vi.fn(),
  avanzarLibroEnSegundoPlano: vi.fn(),
  guardarSuscripcion: vi.fn(),
  borrarSuscripcion: vi.fn(),
  contarSuscripciones: vi.fn(),
  clavePublicaPush: vi.fn(),
  enviarPrueba: vi.fn(),
  obtenerTarea: vi.fn(),
  obtenerPreferencias: vi.fn(),
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', () => m);

import * as rutaNotificaciones from '@/app/api/nova/notificaciones/route';
import * as rutaTick from '@/app/api/nova/recordatorios/tick/route';
import * as rutaIcs from '@/app/api/nova/tareas/[id]/ics/route';

const U = '11111111-1111-4111-8111-111111111111';
const tick = (secreto?: string) =>
  rutaTick.POST(new Request('http://x/api/nova/recordatorios/tick', { method: 'POST', headers: secreto ? { 'x-nova-tick': secreto } : {} }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('RECORDATORIOS_SECRETO', 'secreto-de-prueba-largo');
  m.exigirSesion.mockResolvedValue({ id: U, email: 'yo@ejemplo.com' });
  m.procesarRecordatorios.mockResolvedValue({ enviados: 1, omitidos: 0, sinDispositivo: 0 });
  m.procesarResumenes.mockResolvedValue({ enviados: 0, sinTareas: 1, omitidos: 0, sinDispositivo: 0 });
  m.avanzarLibroEnSegundoPlano.mockResolvedValue(null);
});

describe('POST /api/nova/recordatorios/tick', () => {
  it('sin el secreto, o con otro, 401 y no hace nada', async () => {
    for (const r of [await tick(), await tick('otro'), await tick('secreto-de-prueba-largX')]) expect(r.status).toBe(401);
    expect(m.procesarRecordatorios).not.toHaveBeenCalled();
    expect(m.avanzarLibroEnSegundoPlano).not.toHaveBeenCalled();
    expect(m.procesarResumenes).not.toHaveBeenCalled();
  });

  it('sin RECORDATORIOS_SECRETO en el servidor, nadie entra', async () => {
    vi.stubEnv('RECORDATORIOS_SECRETO', '');
    expect((await tick('')).status).toBe(401);
  });

  it('con el secreto envía los recordatorios, los resúmenes del día (E11d) y avanza un libro', async () => {
    const r = await tick('secreto-de-prueba-largo');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, recordatorios: { enviados: 1, omitidos: 0, sinDispositivo: 0 },
      resumenes: { enviados: 0, sinTareas: 1, omitidos: 0, sinDispositivo: 0 },
      libro: null,
    });
  });

  it('un fallo en el resumen no impide los recordatorios', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.procesarResumenes.mockRejectedValue(new Error('se cayó'));
    expect(await (await tick('secreto-de-prueba-largo')).json()).toMatchObject({ ok: false, recordatorios: { enviados: 1 }, resumenes: null });
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

describe('GET /api/nova/tareas/[id]/ics (E11d, RB-47)', () => {
  const T = '22222222-2222-4222-8222-222222222222';
  const pedir = (id = T) => rutaIcs.GET(new Request(`https://nova.ejemplo/api/nova/tareas/${id}/ics`), { params: Promise.resolve({ id }) });

  it('devuelve la tarea de la sesión como .ics descargable, con la alarma a la hora fija', async () => {
    m.obtenerTarea.mockResolvedValue({ id: T, titulo: 'Pagar matrícula', fechaLimite: '2026-11-20', horaInicio: null, horaFin: null, recordatorio: 'a_la_hora' });
    m.obtenerPreferencias.mockResolvedValue({ horaRecordatorio: '07:30' });
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="pagar-matricula.ics"');
    expect(r.headers.get('cache-control')).toContain('no-store');
    const texto = (await r.text()).replace(/\r\n /g, ''); // desplegar las líneas largas
    expect(texto).toContain('SUMMARY:Pagar matrícula');
    expect(texto).toContain('TRIGGER:PT7H30M');
    expect(texto).toContain('URL:https://nova.ejemplo/nova/tareas?tarea=' + T);
    expect(m.obtenerTarea).toHaveBeenCalledWith(U, T);
  });

  it('una tarea de otro usuario o inexistente: 404 con el mensaje de siempre', async () => {
    m.obtenerTarea.mockResolvedValue(null);
    m.obtenerPreferencias.mockResolvedValue({ horaRecordatorio: '08:00' });
    const r = await pedir();
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ ok: false, error: { codigo: 'TAREA_NO_ENCONTRADA' } });
  });

  it('un id que no es UUID no llega a la base; sin sesión, 401', async () => {
    expect((await pedir('x')).status).toBe(400);
    expect(m.obtenerTarea).not.toHaveBeenCalled();
    const { ErrorDeNegocio } = await import('@/lib/reglas/errores');
    m.exigirSesion.mockRejectedValue(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await pedir()).status).toBe(401);
  });
});
