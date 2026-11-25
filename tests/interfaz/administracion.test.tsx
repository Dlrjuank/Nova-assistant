// E20c-2 (5.14, B-103 a B-105, RB-82 a RB-93): la pantalla "Administración" y el menú solo para administradores.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ refresh: vi.fn(), ruta: '/nova/administracion' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh, replace: vi.fn(), push: vi.fn() }), usePathname: () => nav.ruta }));

import { PanelAdministracion } from '@/components/nova/administracion/PanelAdministracion';
import { BarraInferior } from '@/components/nova/navegacion/BarraInferior';
import { BarraLateral } from '@/components/nova/navegacion/BarraLateral';
import type { CuentaAdmin, PanelAdministracion as Panel } from '@/lib/datos/administracion';
import type { Nivel } from '@/lib/reglas/cuentas';

const AHORA = '2026-11-25T20:00:00.000Z';
const MB = 1024 * 1024;

function cuenta(c: Partial<CuentaAdmin> & { id: string; correo: string }): CuentaAdmin {
  return { nombre: '', registro: '2026-11-20T10:00:00Z', ultimoAcceso: '2026-11-25T18:00:00Z', bytes: 2 * MB, consultas: 0, conClave: false, estado: 'activa', nivel: 'usuario', usaClaveProyecto: false, ...c };
}

function panel(nivel: Nivel, extra: Partial<Panel> = {}): Panel {
  return {
    ahora: AHORA,
    yo: { id: nivel === 'dueno' ? 'd' : 'a', nivel },
    cuentas: [
      cuenta({ id: 'd', correo: 'dueno@x.com', nombre: 'Juan', nivel: 'dueno', bytes: 3 * MB }),
      cuenta({ id: 'a', correo: 'admin@x.com', nombre: 'Ada', nivel: 'admin' }),
      cuenta({ id: 'u1', correo: 'laura@x.com', nombre: 'Laura', conClave: true, consultas: 12, bytes: 28.6 * MB }),
      cuenta({ id: 'u2', correo: 'mateo@x.com', nombre: 'Mateo', estado: 'bloqueada' }),
      cuenta({ id: 'u3', correo: 'nueva@x.com', estado: 'pendiente', ultimoAcceso: null, registro: '2026-11-25T19:00:00Z' }),
    ],
    topes: { cuentas: 15, mb: 30 },
    espacio: { baseBytes: 410 * MB, blobBytes: 12 * MB },
    actividad: { dias: Array.from({ length: 14 }, (_, i) => `2026-11-${String(12 + i).padStart(2, '0')}`), preguntas: [...Array(13).fill(1), 5], registros: Array(14).fill(0), documentos: Array(14).fill(0) },
    sistema: { ultimoAviso: '2026-11-25T19:59:48Z', erroresDia: 0, ultimaLimpieza: null, filasLimpiadas: null },
    registro: [{ id: 1, fecha: '2026-11-25T19:42:00Z', admin: 'dueno@x.com', accion: 'bloquear', correo: 'mateo@x.com', detalle: null }],
    ...extra,
  };
}

const pedidos: Array<{ url: string; metodo: string; cuerpo: unknown }> = [];
function responder(datos: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      pedidos.push({ url, metodo: init.method ?? 'GET', cuerpo: init.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(ok ? { ok: true, datos } : { ok: false, error: { mensaje: datos } }), { status });
    }),
  );
}

/** La tabla del computador (en jsdom están la tabla y las tarjetas; se busca en la tabla). */
const tabla = () => screen.getByRole('table', { name: 'Cuentas de Nova' });
const fila = (correo: string) => tabla().querySelector(`tr[data-cuenta="${correo}"]`) as HTMLElement;

beforeEach(() => {
  pedidos.length = 0;
  nav.refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PanelAdministracion', () => {
  it('B-103: resumen con los administradores aparte, medidores con su porcentaje y avisos, y actividad', () => {
    render(<PanelAdministracion panel={panel('dueno')} />);
    const resumen = screen.getByRole('list', { name: 'Resumen' });
    expect(within(resumen).getByText(/2 administradores aparte · 1 pendiente/)).toBeTruthy();
    expect(within(resumen).getByText('/ 15', { exact: false })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Base de datos: 82 % del plan gratuito. Avisos al 80 % y al 95 %.' })).toBeTruthy();
    expect(screen.getByText('La base va en 82 % del plan gratuito.')).toBeTruthy();
    expect(document.querySelectorAll('[data-medidor="base"] [data-marca]')).toHaveLength(2);
    expect(screen.getByText(/Recordatorios al día · último aviso hace 12 s/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Registros' }));
    expect(screen.getByRole('button', { name: 'Registros' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Ver los datos en una tabla')).toBeTruthy();
  });

  it('B-104: búsqueda por correo o nombre, filtros y el texto sin coincidencias', () => {
    render(<PanelAdministracion panel={panel('dueno')} />);
    fireEvent.change(screen.getByLabelText('Buscar cuenta'), { target: { value: 'LAU' } });
    expect(tabla().querySelectorAll('tbody tr')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Buscar cuenta'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bloqueadas' }));
    expect([...tabla().querySelectorAll('tbody tr')].map((f) => f.getAttribute('data-cuenta'))).toEqual(['mateo@x.com']);
    fireEvent.click(screen.getByRole('button', { name: 'Sin clave' }));
    expect(tabla().querySelectorAll('tbody tr')).toHaveLength(4);
    fireEvent.change(screen.getByLabelText('Buscar cuenta'), { target: { value: 'zzz' } });
    expect(screen.getByText('Ninguna cuenta coincide con la búsqueda.')).toBeTruthy();
  });

  it('RB-93: el administrador ve habilitar, bloquear y desbloquear de usuarios; nada sobre el dueño, otro admin ni eliminar', () => {
    render(<PanelAdministracion panel={panel('admin')} />);
    expect(within(fila('nueva@x.com')).getByRole('button', { name: 'Habilitar: nueva@x.com' })).toBeTruthy();
    expect(within(fila('laura@x.com')).getByRole('button', { name: 'Bloquear: laura@x.com' })).toBeTruthy();
    expect(within(fila('mateo@x.com')).getByRole('button', { name: 'Desbloquear: mateo@x.com' })).toBeTruthy();
    expect(within(fila('dueno@x.com')).queryAllByRole('button')).toHaveLength(0);
    expect(within(fila('admin@x.com')).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: /^Eliminar/ })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: /Nombrar administrador/ })).toHaveLength(0);
    expect(screen.getByText('Solo el dueño cambia los topes.')).toBeTruthy();
  });

  it('el dueño además ve nombrar o quitar administrador, la clave del proyecto y eliminar', () => {
    render(<PanelAdministracion panel={panel('dueno')} />);
    expect(within(fila('admin@x.com')).getByRole('button', { name: 'Quitar administrador: admin@x.com' })).toBeTruthy();
    expect(within(fila('laura@x.com')).getByRole('button', { name: 'Nombrar administrador: laura@x.com' })).toBeTruthy();
    expect(within(fila('laura@x.com')).getByRole('button', { name: 'Dar la clave del proyecto: laura@x.com' })).toBeTruthy();
    expect(within(fila('laura@x.com')).getByRole('button', { name: 'Eliminar: laura@x.com' })).toBeTruthy();
    expect(within(fila('admin@x.com')).queryByRole('button', { name: /Eliminar/ })).toBeNull();
    expect(within(fila('dueno@x.com')).queryAllByRole('button')).toHaveLength(0);
  });

  it('B-105 y RB-82: bloquear pide confirmación con el texto exacto, llama a la API y vuelve a pedir la página', async () => {
    responder({ estado: 'bloqueada', nivel: 'usuario', usaClaveProyecto: false });
    render(<PanelAdministracion panel={panel('admin')} />);
    fireEvent.click(within(fila('laura@x.com')).getByRole('button', { name: 'Bloquear: laura@x.com' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('¿Bloquear a laura@x.com? No podrá entrar a Nova hasta que la desbloquees.')).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Bloquear' }));
    await waitFor(() => expect(screen.getByText('Se bloqueó a laura@x.com.')).toBeTruthy());
    expect(pedidos).toEqual([{ url: '/api/nova/administracion/cuentas/u1', metodo: 'POST', cuerpo: { accion: 'bloquear' } }]);
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('RB-84: eliminar solo se activa con el correo escrito igual; el mensaje final dice cuál se eliminó', async () => {
    responder({ correo: 'laura@x.com' });
    render(<PanelAdministracion panel={panel('dueno')} />);
    fireEvent.click(within(fila('laura@x.com')).getByRole('button', { name: 'Eliminar: laura@x.com' }));
    const dialogo = screen.getByRole('dialog');
    const campo = within(dialogo).getByLabelText('Escribe laura@x.com para confirmar. Se borrarán su cuenta y todos sus datos; no se puede deshacer.');
    const boton = within(dialogo).getByRole('button', { name: 'Eliminar cuenta' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    fireEvent.change(campo, { target: { value: 'laura@x.co' } });
    expect(boton.disabled).toBe(true);
    fireEvent.change(campo, { target: { value: 'Laura@x.com' } });
    expect(boton.disabled).toBe(false);
    fireEvent.click(boton);
    await waitFor(() => expect(screen.getByText('Se eliminó la cuenta laura@x.com.')).toBeTruthy());
    expect(pedidos[0]).toEqual({ url: '/api/nova/administracion/cuentas/u1', metodo: 'DELETE', cuerpo: { correo: 'Laura@x.com' } });
  });

  it('un error del servidor se muestra con su mensaje exacto', async () => {
    responder('No tienes permiso para esto.', false, 403);
    render(<PanelAdministracion panel={panel('admin')} />);
    fireEvent.click(within(fila('nueva@x.com')).getByRole('button', { name: 'Habilitar: nueva@x.com' }));
    await waitFor(() => expect(screen.getByText('No tienes permiso para esto.')).toBeTruthy());
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it('RB-88: los topes calculan el margen mientras se cambian y avisan al pasar los 300 MB', async () => {
    responder({ cuentas: 9, mb: 35 });
    render(<PanelAdministracion panel={panel('dueno', { topes: { cuentas: 10, mb: 30 } })} />);
    expect(screen.getByText('10 × 30 MB = 300 MB de 300 MB disponibles.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Subir espacio por persona (mb)' }));
    expect(screen.getByText('10 × 35 MB = 350 MB: pasa de los 300 MB disponibles. Baja un tope o pasa a Supabase Pro.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bajar cuentas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar topes' }));
    await waitFor(() => expect(pedidos[0]).toEqual({ url: '/api/nova/administracion', metodo: 'PATCH', cuerpo: { cuentas: 9, mb: 35 } }));
  });

  it('RB-89: el registro de acciones dice quién, qué, a quién y cuándo', () => {
    render(<PanelAdministracion panel={panel('dueno')} />);
    const registro = document.querySelector('[data-registro-acciones]') as HTMLElement;
    expect(within(registro).getByText('dueno@x.com bloqueó a mateo@x.com')).toBeTruthy();
    expect(within(registro).getByText(/25 nov/)).toBeTruthy();
  });
});

describe('menú (RB-83)', () => {
  it('"Administración" solo aparece para administradores, en la barra lateral y en "Más"', () => {
    render(<BarraLateral email="u@x.com" />);
    expect(screen.queryByRole('link', { name: /Administración/ })).toBeNull();
    cleanup();
    render(<BarraLateral email="a@x.com" administrador />);
    expect(screen.getByRole('link', { name: /Administración/ }).getAttribute('href')).toBe('/nova/administracion');
    cleanup();
    render(<BarraInferior email="a@x.com" administrador />);
    fireEvent.click(screen.getByRole('button', { name: /Más/ }));
    expect(screen.getByRole('link', { name: 'Administración' })).toBeTruthy();
  });
});
