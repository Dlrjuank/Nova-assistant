// E11b (5.10, RB-62, B-55, B-74, B-75): aviso sin conexión, controles desactivados e "Instalar Nova".
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConexionNova } from '@/components/nova/ConexionNova';
import { BloqueInstalar } from '@/components/nova/configuracion/BloqueInstalar';
import { guardarEventoInstalar, type EventoInstalar } from '@/lib/instalacion';
import { ESPERA_GUARDAR_MS } from '@/lib/reglas/sinConexion';

const nav = vi.hoisted(() => ({ ruta: '/nova', busqueda: '', push: vi.fn<(url: string) => void>() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.ruta,
  useSearchParams: () => new URLSearchParams(nav.busqueda),
  useRouter: () => ({ push: (url: string) => nav.push(url) }),
}));

const carga = vi.hoisted(() => ({ cargarPagina: vi.fn<(url: string) => void>(), marcarSalida: vi.fn(), reiniciarSalida: vi.fn(), saliendoDePagina: vi.fn(() => false) }));
vi.mock('@/lib/cargarPagina', () => carga);

let enLinea = true;
beforeEach(() => {
  enLinea = true;
  carga.cargarPagina.mockReset();
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => enLinea);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.head.querySelector('meta[name="nova-copia"]')?.remove();
  guardarEventoInstalar(null);
});

function pantalla() {
  const alGuardar = vi.fn();
  const alElegirDia = vi.fn();
  render(
    <>
      <ConexionNova />
      <a href="/nova/tareas?vista=hoy">Tareas de hoy</a>
      <a href="/nova/asistente">Asistente</a>
      <button type="button" onClick={alGuardar}>
        Completar
      </button>
      <button type="button" data-sin-conexion="permitido" onClick={alElegirDia}>
        Martes
      </button>
      <label>
        <input type="checkbox" /> Hecha
      </label>
    </>,
  );
  return { alGuardar, alElegirDia };
}

const clic = (el: Element) => fireEvent.click(el, { cancelable: true });

describe('ConexionNova', () => {
  it('con conexión no muestra nada ni bloquea', () => {
    const { alGuardar } = pantalla();
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }));
    expect(alGuardar).toHaveBeenCalled();
  });

  it('una página que salió de la copia: aviso con la hora de la copia (Bogotá) y todo lo que escribe, desactivado', () => {
    const meta = document.createElement('meta');
    meta.name = 'nova-copia';
    meta.content = '2026-11-13T18:05:00.000Z';
    document.head.append(meta);
    const { alGuardar, alElegirDia } = pantalla();
    expect(screen.getByRole('status').textContent).toBe('Sin conexión · datos de las 13:05');
    expect(document.documentElement.hasAttribute('data-nova-sin-conexion')).toBe(true);

    expect(clic(screen.getByRole('button', { name: 'Completar' }))).toBe(false); // se canceló
    expect(alGuardar).not.toHaveBeenCalled();
    expect(screen.getByText('Necesitas conexión para esto.')).toBeTruthy();
    expect(clic(screen.getByRole('checkbox'))).toBe(false);
    expect(clic(screen.getByText('Hecha'))).toBe(false);
    expect(clic(screen.getByRole('link', { name: 'Asistente' }))).toBe(false);

    // Lo que solo muestra sigue funcionando, y los enlaces a pantallas con copia también. E11e: estos se abren
    // con una carga completa (la sirve el service worker), no con la navegación de Next.
    fireEvent.click(screen.getByRole('button', { name: 'Martes' }));
    expect(alElegirDia).toHaveBeenCalled();
    expect(screen.queryByText('Necesitas conexión para esto.')).toBeTruthy(); // el aviso anterior sigue un momento
    expect(clic(screen.getByRole('link', { name: 'Tareas de hoy' }))).toBe(false);
    expect(carga.cargarPagina).toHaveBeenCalledWith(expect.stringMatching(/\/nova\/tareas\?vista=hoy$/));
    expect(carga.cargarPagina).toHaveBeenCalledTimes(1); // el Asistente no
  });

  it('al perder la conexión con la página abierta, avisa con la hora en que se cargó; al volver, deja de bloquear', () => {
    const { alGuardar } = pantalla();
    enLinea = false;
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status').textContent).toMatch(/^Sin conexión · datos de las \d{2}:\d{2}$/);
    clic(screen.getByRole('button', { name: 'Completar' }));
    expect(alGuardar).not.toHaveBeenCalled();
    enLinea = true;
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }));
    expect(alGuardar).toHaveBeenCalled();
    expect(document.documentElement.hasAttribute('data-nova-sin-conexion')).toBe(false);
  });

  it('guarda el aviso "Instalar" de Chrome para ofrecerlo en Configuración', () => {
    render(<ConexionNova />);
    render(<BloqueInstalar />);
    const evento = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    act(() => {
      window.dispatchEvent(evento);
    });
    expect(evento.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(evento.prompt).toHaveBeenCalled();
  });
});

describe('ConexionNova: guardar al navegar sin recargar (corrección de E11b)', () => {
  function conServiceWorker(controlada: boolean) {
    const postMessage = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: controlada ? {} : null,
        // Tras iniciar sesión, `ready` nunca se resuelve (la pestaña nació fuera del alcance): no se debe usar.
        ready: new Promise(() => undefined),
        getRegistration: vi.fn().mockResolvedValue({ active: { postMessage } }),
        register: vi.fn().mockResolvedValue({}),
      },
    });
    vi.stubEnv('NODE_ENV', 'production');
    return postMessage;
  }
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });
  const ir = (ruta: string, busqueda = '') => {
    nav.ruta = ruta;
    nav.busqueda = busqueda;
  };
  /** Avanza el reloj y deja correr las promesas pendientes. */
  const pasar = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

  it('en cada cambio de ruta a una pantalla guardable, le pide al service worker guardarla cuando la pantalla queda quieta', async () => {
    const postMessage = conServiceWorker(true);
    ir('/nova');
    const { rerender } = render(<ConexionNova />);
    await pasar(ESPERA_GUARDAR_MS + 100);
    expect(postMessage).not.toHaveBeenCalled(); // la carga completa ya la guardó el service worker
    ir('/nova/tareas', 'vista=hoy');
    rerender(<ConexionNova />);
    await pasar(ESPERA_GUARDAR_MS - 100);
    expect(postMessage).not.toHaveBeenCalled(); // todavía no: no compite con la navegación
    await pasar(200);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ tipo: 'nova-guardar-ruta', url: `${location.origin}/nova/tareas?vista=hoy` });
  });

  it('si se cambia de pestaña antes de la espera, no pide las pantallas por las que solo pasó', async () => {
    const postMessage = conServiceWorker(true);
    ir('/nova');
    const { rerender } = render(<ConexionNova />);
    for (const [ruta, busqueda] of [['/nova/tareas', ''], ['/nova/calendario', ''], ['/nova/asistente', ''], ['/nova', 'semana=2026-11-16']] as const) {
      ir(ruta, busqueda);
      rerender(<ConexionNova />);
      await pasar(300);
    }
    await pasar(ESPERA_GUARDAR_MS);
    expect(postMessage.mock.calls.map(([m]) => m.url)).toEqual([`${location.origin}/nova?semana=2026-11-16`]);
  });

  it('si el service worker todavía no controla la página, también pide guardar la primera', async () => {
    const postMessage = conServiceWorker(false);
    ir('/nova/tareas');
    render(<ConexionNova />);
    await pasar(ESPERA_GUARDAR_MS + 100);
    expect(postMessage).toHaveBeenCalledWith({ tipo: 'nova-guardar-ruta', url: `${location.origin}/nova/tareas` });
  });

  it('sin conexión no pide nada, tampoco si se pierde durante la espera', async () => {
    const postMessage = conServiceWorker(false);
    enLinea = false;
    ir('/nova/tareas');
    const { unmount } = render(<ConexionNova />);
    await pasar(ESPERA_GUARDAR_MS + 100);
    unmount();
    enLinea = true;
    render(<ConexionNova />);
    enLinea = false;
    await pasar(ESPERA_GUARDAR_MS + 100);
    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe('BloqueInstalar (B-55)', () => {
  it('sin el aviso de Chrome, la guía de Android', () => {
    render(<BloqueInstalar />);
    expect(screen.getByText(/«Instalar app»/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Instalar' })).toBeNull();
  });

  it('en el iPhone, la guía de Safari', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1');
    render(<BloqueInstalar />);
    expect(screen.getByText('Toca «Agregar a inicio» y luego «Agregar».')).toBeTruthy();
    expect(screen.getByText(/la app instalada tiene su propia sesión/)).toBeTruthy();
  });

  it('abierta como app, dice que ya está instalada', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    render(<BloqueInstalar />);
    expect(screen.getByText('Nova ya está instalada en este dispositivo.')).toBeTruthy();
  });

  it('si se rechaza el aviso de Chrome, queda la guía', async () => {
    guardarEventoInstalar(
      Object.assign(new Event('beforeinstallprompt'), {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
      }) as EventoInstalar,
    );
    render(<BloqueInstalar />);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(await screen.findByText(/«Instalar app»/)).toBeTruthy();
  });
});
