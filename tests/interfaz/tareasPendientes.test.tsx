// E11e (5.13; RB-70 a RB-75; S-77 a S-80): crear sin conexión, cómo se ven las pendientes, su envío y cerrar sesión.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TareaPendiente } from '@/lib/reglas/tareasPendientes';

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/nova/tareas/nueva' }));
const carga = vi.hoisted(() => ({ cargarPagina: vi.fn(), marcarSalida: vi.fn(), reiniciarSalida: vi.fn(), saliendoDePagina: vi.fn(() => false) }));
vi.mock('@/lib/cargarPagina', () => carga);

// IndexedDB no existe en jsdom: el almacén del dispositivo se cambia por uno en memoria con la misma interfaz.
const mem = vi.hoisted(() => {
  const mapa = new Map<string, unknown>();
  const oyentes = new Set<() => void>();
  const avisar = () => oyentes.forEach((f) => f());
  return {
    mapa,
    oyentes,
    almacen: {
      listar: async () => [...mapa.values()].map((t) => ({ ...(t as object) })),
      guardar: async (t: { idCliente: string }) => {
        mapa.set(t.idCliente, { ...t });
        avisar();
      },
      borrar: async (id: string) => {
        mapa.delete(id);
        avisar();
      },
    },
  };
});
vi.mock('@/lib/tareasPendientes', async (original) => {
  const real = await original<typeof import('@/lib/tareasPendientes')>();
  const a = mem.almacen as unknown as import('@/lib/tareasPendientes').Almacen;
  return {
    ...real,
    almacenDispositivo: a,
    listarPendientes: (u: string) => real.listarPendientes(u, a),
    obtenerPendiente: (id: string, u: string) => real.obtenerPendiente(id, u, a),
    borrarPendientesDeOtros: (u: string) => real.borrarPendientesDeOtros(u, a),
    borrarTodasPendientes: () => real.borrarTodasPendientes(a),
    enviarPendientes: (u: string) => real.enviarPendientes(u, { almacen: a, pedir: (...x: Parameters<typeof fetch>) => fetch(...x) }),
    escucharPendientes: (f: () => void) => {
      mem.oyentes.add(f);
      return () => mem.oyentes.delete(f);
    },
  };
});

import { FormularioTarea } from '@/components/nova/FormularioTarea';
import { useCerrarSesion } from '@/components/nova/navegacion/useCerrarSesion';
import { PendientesDeEnviar } from '@/components/nova/pendientes/PendientesDeEnviar';
import { ProveedorPendientes } from '@/components/nova/pendientes/ProveedorPendientes';
import { SoloSinPendientes } from '@/components/nova/pendientes/SoloSinPendientes';
import { TareaPendienteFila } from '@/components/nova/pendientes/TareaPendienteFila';

const U = 'u1';
const pendiente = (id: string, extra: Partial<TareaPendiente> = {}): TareaPendiente => ({
  idCliente: id,
  usuarioId: U,
  creadaEn: Date.now(),
  datos: { titulo: `Tarea ${id}`, categoria: 'Universidad', prioridad: 3, fechaLimite: '2099-01-10', horaInicio: '10:00', horaFin: null, recordatorio: null },
  estado: 'pendiente',
  ...extra,
});
const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
const enLinea = (si: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => si });
const conProveedor = (hijo: React.ReactNode) => <ProveedorPendientes usuarioId={U}>{hijo}</ProveedorPendientes>;

beforeEach(() => {
  mem.mapa.clear();
  mem.oyentes.clear();
  nav.push.mockReset();
  nav.refresh.mockReset();
  nav.replace.mockReset();
  carga.cargarPagina.mockReset();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  enLinea(true);
  window.history.replaceState(null, '', '/');
});

describe('S-77 · RB-70: crear sin conexión', () => {
  it('sin conexión guarda en el dispositivo a nombre del usuario, sin pedir nada, y vuelve con el aviso', async () => {
    enLinea(false);
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(conProveedor(<FormularioTarea fechaInicial="2099-01-10" />));
    escribir('Título', '  Leer   capítulo 3 ');
    escribir('Categoría', 'Lectura');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    // Sin conexión, una carga completa (la sirve el service worker), no la navegación de Next.
    await waitFor(() => expect(carga.cargarPagina).toHaveBeenCalledWith('/nova/tareas'));
    expect(nav.push).not.toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
    const [guardada] = [...mem.mapa.values()] as TareaPendiente[];
    expect(guardada).toMatchObject({ usuarioId: U, estado: 'pendiente', datos: { titulo: 'Leer   capítulo 3', categoria: 'Lectura', fechaLimite: '2099-01-10' } });
    expect(guardada?.idCliente).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText('Guardada en este dispositivo. Se enviará cuando vuelva la conexión.')).toBeTruthy();
    expect(sessionStorage.getItem('nova-aviso-pendientes')).toBe('Guardada en este dispositivo. Se enviará cuando vuelva la conexión.');
  });

  it('las mismas validaciones: sin título no se guarda nada', async () => {
    enLinea(false);
    render(conProveedor(<FormularioTarea fechaInicial="2099-01-10" />));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    expect(await screen.findByText('El título es obligatorio.')).toBeTruthy();
    expect(mem.mapa.size).toBe(0);
  });

  it('si el pedido falla por la red, queda en el dispositivo con el mismo idCliente que se intentó enviar', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', f);
    render(conProveedor(<FormularioTarea fechaInicial="2099-01-10" />));
    escribir('Título', 'Clase');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    await waitFor(() => expect(mem.mapa.size).toBe(1));
    const enviado = JSON.parse(String(f.mock.calls.find(([u]) => u === '/api/nova/tareas')?.[1]?.body));
    expect([...mem.mapa.keys()]).toEqual([enviado.idCliente]);
  });

  it('con 50 sin enviar, no deja crear más', async () => {
    for (let i = 0; i < 50; i++) mem.mapa.set(`t${i}`, pendiente(`t${i}`));
    enLinea(false);
    vi.stubGlobal('fetch', vi.fn());
    render(conProveedor(<FormularioTarea fechaInicial="2099-01-10" />));
    escribir('Título', 'Una más');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    expect(await screen.findByText('Ya tienes 50 tareas sin enviar. Conéctate para enviarlas antes de crear más.')).toBeTruthy();
    expect(mem.mapa.size).toBe(50);
    expect(nav.push).not.toHaveBeenCalled();
    expect(carga.cargarPagina).not.toHaveBeenCalled();
  });

  it('sin conexión, editar no se guarda en el dispositivo', async () => {
    enLinea(false);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(conProveedor(<FormularioTarea tarea={{ id: 't9', titulo: 'Vieja', categoria: 'General', prioridad: 2, fechaLimite: '2099-01-10' }} />));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('No se pudo conectar con el servidor. Intenta de nuevo.')).toBeTruthy();
    expect(mem.mapa.size).toBe(0);
  });
});

describe('RB-71 y RB-74: cómo se ve una pendiente', () => {
  it('con su insignia, sin casilla; "Descartar" pide confirmación y la borra', async () => {
    mem.mapa.set('a', pendiente('a'));
    render(<TareaPendienteFila tarea={pendiente('a')} />);
    expect(screen.getByText('Pendiente de enviar')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Corregir' })).toBeNull();
    expect(screen.getByText('Tarea a').closest('[data-sin-conexion="permitido"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar tarea: Tarea a' }));
    expect(screen.getByText('¿Descartar esta tarea? No se enviará.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    });
    expect(mem.mapa.size).toBe(0);
  });

  it('rechazada: el mensaje exacto del servidor y "Corregir" con su idCliente', () => {
    render(<TareaPendienteFila tarea={pendiente('a', { estado: 'rechazada', error: 'La fecha límite no es válida' })} />);
    expect(screen.getByText('No se pudo enviar: La fecha límite no es válida')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Corregir' }).getAttribute('href')).toBe('/nova/tareas/nueva?corregir=a');
  });

  it('arriba de Tareas: "{n} tareas pendientes de enviar" solo mientras haya', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    mem.mapa.set('a', pendiente('a'));
    mem.mapa.set('b', pendiente('b'));
    enLinea(false);
    render(conProveedor(<PendientesDeEnviar />));
    expect(await screen.findByText('2 tareas pendientes de enviar')).toBeTruthy();
    await act(async () => {
      await mem.almacen.borrar('a');
      await mem.almacen.borrar('b');
    });
    await waitFor(() => expect(screen.queryByTestId('pendientes-de-enviar')).toBeNull());
  });

  it('"Corregir" llena el formulario y reenvía con el mismo idCliente; al llegar, sale del dispositivo', async () => {
    mem.mapa.set('a', pendiente('a', { estado: 'rechazada', error: 'La categoría no es válida' }));
    window.history.replaceState(null, '', '/nova/tareas/nueva?corregir=a');
    const f = vi.fn(async (url: string) =>
      url === '/api/nova/tareas' ? new Response(JSON.stringify({ ok: true, datos: { recordatorioEstado: null } }), { status: 201 }) : new Response('{}', { status: 503 }),
    );
    vi.stubGlobal('fetch', f);
    render(conProveedor(<FormularioTarea />));
    await waitFor(() => expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Tarea a'));
    expect(screen.getByText('La categoría no es válida')).toBeTruthy();
    escribir('Categoría', 'General');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/nova/tareas'));
    const envio = (f.mock.calls as unknown[][]).filter(([u]) => u === '/api/nova/tareas').map((c) => JSON.parse(String((c[1] as RequestInit).body)));
    expect(envio.at(-1)).toMatchObject({ idCliente: 'a', titulo: 'Tarea a', categoria: 'General' });
    expect(mem.mapa.has('a')).toBe(false);
  });
});

describe('S-78 · RB-72: envío al abrir con conexión', () => {
  it('envía las del usuario, avisa "Se enviaron…", actualiza la pantalla y borra las de otro usuario sin enviarlas', async () => {
    mem.mapa.set('a', pendiente('a', { creadaEn: 1 }));
    mem.mapa.set('b', pendiente('b', { creadaEn: 2 }));
    mem.mapa.set('x', pendiente('x', { usuarioId: 'otro' }));
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, datos: {} }), { status: 201 }));
    vi.stubGlobal('fetch', f);
    render(conProveedor(<p>Nova</p>));
    expect(await screen.findByText('Se enviaron 2 tareas que creaste sin conexión.')).toBeTruthy();
    expect((f.mock.calls as unknown[][]).map((c) => JSON.parse(String((c[1] as RequestInit).body)).idCliente)).toEqual(['a', 'b']);
    expect(mem.mapa.size).toBe(0);
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('sin conexión no intenta; al volver la conexión, sí', async () => {
    mem.mapa.set('a', pendiente('a'));
    enLinea(false);
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, datos: {} }), { status: 201 }));
    vi.stubGlobal('fetch', f);
    render(conProveedor(<p>Nova</p>));
    await act(async () => undefined);
    expect(f).not.toHaveBeenCalled();
    enLinea(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(await screen.findByText('Se envió 1 tarea que creaste sin conexión.')).toBeTruthy();
  });

  it('un aviso guardado antes de cambiar de pantalla se muestra al abrir la siguiente', async () => {
    sessionStorage.setItem('nova-aviso-pendientes', 'Guardada en este dispositivo. Se enviará cuando vuelva la conexión.');
    enLinea(false);
    render(conProveedor(<p>Nova</p>));
    expect(await screen.findByText('Guardada en este dispositivo. Se enviará cuando vuelva la conexión.')).toBeTruthy();
    expect(sessionStorage.getItem('nova-aviso-pendientes')).toBeNull();
  });
});

describe('S-80 · RB-75: cerrar sesión con tareas sin enviar', () => {
  function BotonSalir() {
    const { cerrarSesion } = useCerrarSesion();
    return (
      <button type="button" onClick={() => void cerrarSesion()}>
        Salir
      </button>
    );
  }

  it('avisa cuántas hay; "Cancelar" no cierra; "Cerrar sesión y borrarlas" las borra y cierra', async () => {
    mem.mapa.set('a', pendiente('a'));
    enLinea(false); // que no se envíe sola durante la prueba
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    render(conProveedor(<BotonSalir />));
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(await screen.findByText('Tienes 1 tarea sin enviar. Si cierras sesión, se borrará de este dispositivo.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => undefined);
    expect(f).not.toHaveBeenCalled();
    expect(mem.mapa.size).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión y borrarlas' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'));
    expect(f).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(mem.mapa.size).toBe(0);
  });

  it('sin pendientes cierra sesión directo', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    render(conProveedor(<BotonSalir />));
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'));
  });
});

describe('Tareas con solo pendientes de enviar', () => {
  it('no muestra "Aún no tienes tareas" mientras haya pendientes; sin ellas, sí', async () => {
    enLinea(false);
    mem.mapa.set('a', pendiente('a'));
    const { unmount } = render(
      conProveedor(
        <SoloSinPendientes>
          <p>Aún no tienes tareas</p>
        </SoloSinPendientes>,
      ),
    );
    await waitFor(() => expect(screen.queryByText('Aún no tienes tareas')).toBeNull());
    unmount();
    mem.mapa.clear();
    render(
      conProveedor(
        <SoloSinPendientes>
          <p>Aún no tienes tareas</p>
        </SoloSinPendientes>,
      ),
    );
    expect(await screen.findByText('Aún no tienes tareas')).toBeTruthy();
  });
});
