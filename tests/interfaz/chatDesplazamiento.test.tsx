// El chat lleva la vista al último mensaje (pedido del usuario, 2026-11-07). jsdom no tiene diseño, así que
// las posiciones del formulario y del último mensaje se simulan con getBoundingClientRect.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chat } from '@/components/nova/Chat';
import { calcularDesplazamiento, zonaVisible } from '@/components/nova/seguirConversacion';

const pantalla = { alto: 800, finFormulario: 790, inicioUltimo: 500 };
const rect = (r: Partial<DOMRect>) => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...r }) as DOMRect;
const scrollBy = vi.fn();
let menosMovimiento = false;

function respuestaControlada() {
  let resolver!: (r: Response) => void;
  const promesa = new Promise<Response>((r) => (resolver = r));
  const ok = (respuesta: string) =>
    resolver(new Response(JSON.stringify({ ok: true, datos: { respuesta, fuentes: [], conversacionId: 'c1', guardada: true } }), { status: 200 }));
  return { promesa, ok };
}

function preguntar(texto: string) {
  fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: texto } });
  fireEvent.click(screen.getByRole('button', { name: 'Preguntar' }));
}

beforeEach(() => {
  Object.assign(pantalla, { alto: 800, finFormulario: 790, inicioUltimo: 500 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: pantalla.alto });
  vi.spyOn(HTMLFormElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect({ bottom: pantalla.finFormulario }));
  vi.spyOn(HTMLLIElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect({ top: pantalla.inicioUltimo }));
  scrollBy.mockReset();
  window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
  menosMovimiento = false;
  window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce') && menosMovimiento })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.querySelectorAll('[data-barra-inferior]').forEach((n) => n.remove());
});

describe('calcularDesplazamiento (puro)', () => {
  const zona = { arriba: 0, abajo: 800 };
  it('si el final ya se ve, no se mueve', () => {
    expect(calcularDesplazamiento(700, 600, zona)).toBe(0);
  });
  it('baja lo justo para dejar el final sobre el borde inferior (con margen de 16 px)', () => {
    expect(calcularDesplazamiento(1000, 900, zona)).toBe(216);
  });
  it('si el último mensaje es más alto que la pantalla, no esconde su comienzo', () => {
    expect(calcularDesplazamiento(3000, 1200, zona)).toBe(1184);
  });
});

describe('zonaVisible', () => {
  it('descuenta la barra inferior del teléfono cuando se ve', () => {
    const barra = document.createElement('nav');
    barra.setAttribute('data-barra-inferior', '');
    barra.getClientRects = () => [rect({})] as unknown as DOMRectList;
    barra.getBoundingClientRect = () => rect({ top: 720 });
    document.body.appendChild(barra);
    expect(zonaVisible()).toEqual({ arriba: 0, abajo: 720 });
  });
  it('en el computador la barra no se ve y no descuenta nada', () => {
    const barra = document.createElement('nav');
    barra.setAttribute('data-barra-inferior', '');
    barra.getClientRects = () => [] as unknown as DOMRectList;
    document.body.appendChild(barra);
    expect(zonaVisible()).toEqual({ arriba: 0, abajo: 800 });
  });
});

describe('el chat sigue a la conversación', () => {
  it('al enviar baja hasta el mensaje nuevo, con animación suave', async () => {
    const r = respuestaControlada();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(r.promesa));
    render(<Chat />);
    pantalla.finFormulario = 1100; // el mensaje nuevo empujó el formulario por debajo de la pantalla
    pantalla.inicioUltimo = 950;
    preguntar('¿Tengo alguna tarea?');
    await waitFor(() => expect(scrollBy).toHaveBeenCalledWith({ top: 316, behavior: 'smooth' }));
  });

  it('al llegar la respuesta, si sigue al final, vuelve a bajar', async () => {
    const r = respuestaControlada();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(r.promesa));
    render(<Chat />);
    pantalla.finFormulario = 1100;
    preguntar('¿Tengo alguna tarea?');
    await waitFor(() => expect(scrollBy).toHaveBeenCalledTimes(1));
    r.ok('No tienes tareas pendientes.');
    await screen.findByText('No tienes tareas pendientes.');
    await waitFor(() => expect(scrollBy).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Ir al final' })).toBeNull();
  });

  it('si el usuario subió a leer algo anterior, la respuesta no lo mueve y aparece "Ir al final"', async () => {
    const r = respuestaControlada();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(r.promesa));
    render(<Chat />);
    pantalla.finFormulario = 700; // el final ya se ve: no hace falta desplazarse
    preguntar('¿Tengo alguna tarea?');
    await screen.findByText('Pensando…');
    await new Promise((r) => setTimeout(r, 50)); // el chat termina de seguir el envío (un cuadro)
    pantalla.finFormulario = 3000; // el usuario subió: el final quedó 2200 px por debajo
    fireEvent.scroll(window);
    r.ok('No tienes tareas pendientes.');
    await screen.findByText('No tienes tareas pendientes.');
    const irAlFinal = await screen.findByRole('button', { name: 'Ir al final' });
    expect(scrollBy).not.toHaveBeenCalled();

    fireEvent.click(irAlFinal);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0]?.[0].top).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Ir al final' })).toBeNull();
  });

  it('con "reducir movimiento" activado, baja sin animación', async () => {
    menosMovimiento = true;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<Chat />);
    pantalla.finFormulario = 1100;
    preguntar('¿Tengo alguna tarea?');
    await waitFor(() => expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' })));
  });

  it('en el teléfono, la barra inferior no tapa el último mensaje', async () => {
    const barra = document.createElement('nav');
    barra.setAttribute('data-barra-inferior', '');
    barra.getClientRects = () => [rect({})] as unknown as DOMRectList;
    barra.getBoundingClientRect = () => rect({ top: 720 });
    document.body.appendChild(barra);
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<Chat />);
    pantalla.finFormulario = 760; // se vería en la pantalla, pero queda debajo de la barra (que empieza en 720)
    pantalla.inicioUltimo = 600;
    preguntar('¿Tengo alguna tarea?');
    await waitFor(() => expect(scrollBy).toHaveBeenCalledWith({ top: 56, behavior: 'smooth' }));
  });

  it('en el teléfono, si el teclado se abre y estaba al final, el último mensaje sigue a la vista', async () => {
    const vv = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
    vi.stubGlobal('visualViewport', vv);
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<Chat />);
    pantalla.finFormulario = 700;
    preguntar('¿Tengo alguna tarea?'); // el final se ve: no se mueve
    await screen.findByText('Pensando…');
    await new Promise((r) => setTimeout(r, 50));
    expect(scrollBy).not.toHaveBeenCalled();
    vv.height = 420; // se abre el teclado: ahora el final (700) queda debajo de lo visible (420)
    vv.dispatchEvent(new Event('resize'));
    expect(scrollBy).toHaveBeenCalledWith({ top: 296, behavior: 'auto' });
  });

  it('al abrir una conversación guardada, muestra lo último sin animación', async () => {
    pantalla.finFormulario = 2000;
    pantalla.inicioUltimo = 1800;
    render(<Chat historial={[{ id: 1, autor: 'usuario', texto: 'hola', fuentes: [] }, { id: 2, autor: 'asistente', texto: 'qué tal', fuentes: [] }]} />);
    await waitFor(() => expect(scrollBy).toHaveBeenCalledWith({ top: 1216, behavior: 'auto' }));
  });
});
