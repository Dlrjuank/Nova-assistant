// E11c (5.10; RB-43, RB-45): campo Recordatorio, panel de notificaciones y la tarea resaltada.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/nova/tareas/nueva' }));

import { PanelNotificaciones } from '@/components/nova/PanelNotificaciones';
import { FormularioTarea } from '@/components/nova/FormularioTarea';
import { ProveedorPreferencias } from '@/components/nova/PreferenciasNova';
import { ResaltarTarea } from '@/components/nova/ResaltarTarea';

const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
const opciones = () => [...(screen.getByLabelText('Recordatorio') as HTMLSelectElement).options].map((o) => o.text);
const valor = () => (screen.getByLabelText('Recordatorio') as HTMLSelectElement).value;

/** Un navegador con push: permiso, service worker con pushManager y la API de Nova simulada. */
function conPush({ permiso = 'default' as NotificationPermission, suscrito = false } = {}) {
  const requestPermission = vi.fn().mockResolvedValue('granted');
  const suscripcion = { endpoint: 'https://push.ejemplo/1', toJSON: () => ({ endpoint: 'https://push.ejemplo/1', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: vi.fn() };
  const subscribe = vi.fn().mockResolvedValue(suscripcion);
  vi.stubGlobal('Notification', Object.assign(function Notification() {}, { permission: permiso, requestPermission }));
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(suscrito ? suscripcion : null), subscribe } }) },
  });
  const f = vi.fn(async (_url: string, init?: RequestInit) =>
    new Response(JSON.stringify(init?.method === 'POST' ? { ok: true, datos: { suscripciones: 1 } } : { ok: true, datos: { clavePublica: 'AQAB', suscripciones: 0 } })),
  );
  vi.stubGlobal('fetch', f);
  return { requestPermission, subscribe, fetch: f };
}

beforeEach(() => {
  nav.push.mockReset();
  nav.refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('FormularioTarea · Recordatorio (RB-43)', () => {
  it('sin horario: "Sin recordatorio", "El mismo día" y "El día anterior", a la hora fija de Configuración', () => {
    render(
      <ProveedorPreferencias tema="automatico" formatoHora="24" horaRecordatorio="07:30">
        <FormularioTarea fechaInicial="2099-01-10" />
      </ProveedorPreferencias>,
    );
    expect(opciones()).toEqual(['Sin recordatorio', 'El mismo día, a las 7:30', 'El día anterior, a las 7:30']);
    expect(valor()).toBe('');
  });

  it('con horario, 4 opciones; al quitar la hora, "15 min antes" vuelve a "Sin recordatorio"', () => {
    render(<FormularioTarea fechaInicial="2099-01-10" />);
    escribir('Desde', '10:00');
    expect(opciones()).toEqual(['Sin recordatorio', 'A la hora', '15 min antes', '1 hora antes', '1 día antes']);
    escribir('Recordatorio', '15_min');
    expect(valor()).toBe('15_min');
    escribir('Desde', '');
    expect(valor()).toBe('');
  });

  it('si el momento ya pasó, avisa con el texto exacto (la tarea se puede guardar igual)', () => {
    render(<FormularioTarea fechaInicial="2020-01-10" />);
    escribir('Recordatorio', 'a_la_hora');
    expect(screen.getByText('Ese momento ya pasó: no se enviará el recordatorio.')).toBeTruthy();
    escribir('Fecha límite', '2099-01-10');
    expect(screen.queryByText('Ese momento ya pasó: no se enviará el recordatorio.')).toBeNull();
  });

  it('envía el recordatorio elegido; "Sin recordatorio" va como null', async () => {
    const { fetch: f } = conPush({ permiso: 'granted', suscrito: true });
    f.mockImplementation(async () => new Response(JSON.stringify({ ok: true, datos: {} }), { status: 201 }));
    render(<FormularioTarea fechaInicial="2099-01-10" />);
    escribir('Título', 'Clase');
    escribir('Desde', '10:00');
    escribir('Recordatorio', '1_hora');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const envio = f.mock.calls.find(([url]) => url === '/api/nova/tareas');
    expect(JSON.parse(String(envio?.[1]?.body))).toMatchObject({ horaInicio: '10:00', recordatorio: '1_hora' });
  });

  it('al elegir un recordatorio sin notificaciones activas, ofrece activarlas', async () => {
    conPush();
    render(<FormularioTarea fechaInicial="2099-01-10" />);
    expect(screen.queryByRole('button', { name: 'Activar notificaciones' })).toBeNull();
    escribir('Recordatorio', 'a_la_hora');
    expect(await screen.findByRole('button', { name: 'Activar notificaciones' })).toBeTruthy();
    expect(screen.getByText('Activa las notificaciones para recibir este aviso.')).toBeTruthy();
  });
});

describe('PanelNotificaciones (RB-45)', () => {
  it('nunca pide el permiso al mostrarse; solo al tocar "Activar notificaciones", y entonces suscribe y guarda', async () => {
    const p = conPush();
    render(<PanelNotificaciones modo="configuracion" />);
    const boton = await screen.findByRole('button', { name: 'Activar notificaciones' });
    expect(p.requestPermission).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(boton);
    });
    await screen.findByText('Este dispositivo recibe los avisos de Nova.');
    expect(p.requestPermission).toHaveBeenCalledTimes(1);
    expect(p.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    const guardar = p.fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(guardar?.[1]?.body))).toMatchObject({ endpoint: 'https://push.ejemplo/1', keys: { p256dh: 'p', auth: 'a' } });
    expect(screen.getByRole('button', { name: 'Enviar una de prueba' })).toBeTruthy();
  });

  it('bloqueadas: lo explica, sin botón', async () => {
    conPush({ permiso: 'denied' });
    render(<PanelNotificaciones modo="configuracion" />);
    expect(await screen.findByText('Las notificaciones están bloqueadas. Actívalas en los ajustes del teléfono para Nova.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activar notificaciones' })).toBeNull();
  });

  it('en un iPhone sin instalar, la guía para agregar Nova a inicio', async () => {
    conPush();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    render(<PanelNotificaciones modo="formulario" />);
    expect(await screen.findByText(/Para recibir avisos en el iPhone, primero agrega Nova a inicio\./)).toBeTruthy();
  });

  it('activas: en el formulario no dice nada; en Configuración, "Enviar una de prueba"', async () => {
    const p = conPush({ permiso: 'granted', suscrito: true });
    const { container } = render(<PanelNotificaciones modo="formulario" />);
    await waitFor(() => expect(p.fetch).not.toHaveBeenCalled());
    await act(async () => undefined);
    expect(container.textContent).toBe('');
    cleanup();
    p.fetch.mockImplementation(async () => new Response(JSON.stringify({ ok: true, datos: { enviadas: 1, fallidas: 0 } })));
    render(<PanelNotificaciones modo="configuracion" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar una de prueba' }));
    expect(await screen.findByText('Listo: la notificación de prueba va en camino.')).toBeTruthy();
    expect(p.fetch).toHaveBeenCalledWith('/api/nova/notificaciones/prueba', { method: 'POST' });
  });
});

describe('ResaltarTarea', () => {
  it('resalta la tarea visible de la notificación y lo quita a los pocos segundos', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<ul><li data-tarea-id="t1">Clase</li><li data-tarea-id="t2">Otra</li></ul>';
    for (const li of document.querySelectorAll('li')) Object.defineProperty(li, 'offsetParent', { value: document.body });
    render(<ResaltarTarea id="t1" />);
    const t1 = document.querySelector('[data-tarea-id="t1"]');
    expect(t1?.hasAttribute('data-resaltada')).toBe(true);
    expect(document.querySelector('[data-tarea-id="t2"]')?.hasAttribute('data-resaltada')).toBe(false);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(t1?.hasAttribute('data-resaltada')).toBe(false);
  });
});
