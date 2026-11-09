// E03 (PLAN_AMPLIACION 4): barra lateral, barra inferior con hoja "Más", botón "+" e Inicio mínimo.
// En jsdom no hay CSS: la barra lateral y la inferior están las dos en el documento, así que cada prueba
// busca dentro de la que corresponde.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ ruta: '/nova/tareas', push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push, refresh: vi.fn() }),
  usePathname: () => nav.ruta,
}));

import { Chat } from '@/components/nova/Chat';
import { NavegacionNova } from '@/components/nova/NavegacionNova';
import { BarraInferior } from '@/components/nova/navegacion/BarraInferior';
import { BarraLateral } from '@/components/nova/navegacion/BarraLateral';
import { BotonAgregar } from '@/components/nova/navegacion/BotonAgregar';
import { BARRA_INFERIOR, MENU_LATERAL, MENU_MAS, esActivo } from '@/components/nova/navegacion/secciones';
import { PreguntaleANova } from '@/components/nova/PreguntaleANova';
import { MENSAJES } from '@/lib/reglas/errores';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  nav.push.mockReset();
  nav.ruta = '/nova/tareas';
});

describe('secciones (sin botones muertos)', () => {
  it('solo enlazan a rutas que existen hoy', () => {
    const existentes = ['/nova', '/nova/asistente', '/nova/calendario', '/nova/tareas', '/nova/fuentes', '/nova/productividad'];
    const todas = [...MENU_LATERAL, ...BARRA_INFERIOR.izquierda, BARRA_INFERIOR.centro, ...BARRA_INFERIOR.derecha, ...MENU_MAS];
    expect(todas.every((s) => existentes.includes(s.href))).toBe(true);
    expect(MENU_LATERAL.map((s) => s.href)).toEqual(existentes);
  });

  it('la barra inferior más "Más" cubren todas las secciones del menú lateral', () => {
    const inferior = [...BARRA_INFERIOR.izquierda, BARRA_INFERIOR.centro, ...BARRA_INFERIOR.derecha, ...MENU_MAS].map((s) => s.href);
    expect([...inferior].sort()).toEqual(MENU_LATERAL.map((s) => s.href).sort());
    expect(BARRA_INFERIOR.centro.texto).toBe('Asistente');
  });

  it('esActivo: Inicio solo en /nova; las demás también en sus subrutas', () => {
    expect(esActivo('/nova', '/nova')).toBe(true);
    expect(esActivo('/nova/tareas', '/nova')).toBe(false);
    expect(esActivo('/nova/tareas/nueva', '/nova/tareas')).toBe(true);
    expect(esActivo('/nova/tareasx', '/nova/tareas')).toBe(false);
  });
});

describe('BarraLateral (computador)', () => {
  it('muestra las secciones, marca la actual con aria-current y muestra el correo', () => {
    nav.ruta = '/nova/tareas/nueva';
    render(<BarraLateral email="yo@ejemplo.com" />);
    const menu = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(menu).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Inicio',
      'Asistente',
      'Calendario',
      'Tareas',
      'Fuentes',
      'Productividad',
    ]);
    expect(within(menu).getByRole('link', { name: 'Tareas' }).getAttribute('aria-current')).toBe('page');
    expect(within(menu).getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('yo@ejemplo.com')).toBeTruthy();
  });

  it('un fallo al cerrar sesión se muestra', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    render(<BarraLateral email="yo@ejemplo.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('No se pudo cerrar la sesión.')).toBeTruthy();
  });

  it('cerrar sesión lleva al login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    render(<BarraLateral email="yo@ejemplo.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'));
  });
});

describe('BarraInferior y hoja "Más" (teléfono)', () => {
  it('Inicio, Calendario, Asistente al centro, Tareas y Más', () => {
    nav.ruta = '/nova/asistente';
    render(<BarraInferior email="yo@ejemplo.com" />);
    const barra = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(barra).getAllByRole('link').map((a) => a.textContent)).toEqual(['Inicio', 'Calendario', 'Asistente', 'Tareas']);
    expect(within(barra).getByRole('link', { name: 'Asistente' }).getAttribute('aria-current')).toBe('page');
    expect(within(barra).getByRole('button', { name: 'Más' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('si la sección actual está en "Más", el botón "Más" lo indica con aria-current', () => {
    nav.ruta = '/nova/fuentes';
    render(<BarraInferior email="yo@ejemplo.com" />);
    expect(screen.getByRole('button', { name: 'Más' }).getAttribute('aria-current')).toBe('true');
    cleanup();
    nav.ruta = '/nova/tareas';
    render(<BarraInferior email="yo@ejemplo.com" />);
    expect(screen.getByRole('button', { name: 'Más' }).getAttribute('aria-current')).toBeNull();
  });

  it('"Más" abre un diálogo con el resto de secciones y el foco entra en él', () => {
    render(<BarraInferior email="yo@ejemplo.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    const hoja = screen.getByRole('dialog', { name: 'Más secciones' });
    expect(hoja.getAttribute('aria-modal')).toBe('true');
    expect(within(hoja).getAllByRole('link').map((a) => a.textContent)).toEqual(['Fuentes', 'Productividad']);
    expect(within(hoja).getByText('yo@ejemplo.com')).toBeTruthy();
    expect(within(hoja).getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(hoja.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('button', { name: 'Más' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('se cierra con Escape, con "Cerrar" y tocando fuera; el foco vuelve a "Más"', () => {
    render(<BarraInferior email="yo@ejemplo.com" />);
    const mas = screen.getByRole('button', { name: 'Más' });

    fireEvent.click(mas);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(mas);

    fireEvent.click(mas);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(mas);
    fireEvent.click(screen.getByTestId('fondo-hoja'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(mas);
  });

  it('el foco queda atrapado: Tab en el último vuelve al primero y Shift+Tab en el primero va al último', () => {
    render(<BarraInferior email="yo@ejemplo.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    const hoja = screen.getByRole('dialog');
    const enfocables = Array.from(hoja.querySelectorAll<HTMLElement>('a[href], button'));
    const primero = enfocables[0]!;
    const ultimo = enfocables[enfocables.length - 1]!;
    ultimo.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(primero);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ultimo);
  });

  it('elegir una sección de la hoja la cierra', () => {
    render(<BarraInferior email="yo@ejemplo.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    const fuentes = screen.getByRole('link', { name: 'Fuentes' });
    fuentes.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(fuentes);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Botón "+" (teléfono)', () => {
  it('ofrece "Nueva tarea" y "Subir documento" con rutas que existen', () => {
    render(<BotonAgregar />);
    const boton = screen.getByRole('button', { name: 'Agregar' });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(boton);
    expect(screen.getByRole('link', { name: 'Nueva tarea' }).getAttribute('href')).toBe('/nova/tareas/nueva');
    expect(screen.getByRole('link', { name: 'Subir documento' }).getAttribute('href')).toBe('/nova/fuentes?pestana=pdf');
    expect(screen.getByRole('button', { name: 'Cerrar el menú Agregar' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('se cierra con Escape y tocando fuera', () => {
    render(<BotonAgregar />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: 'Nueva tarea' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('link', { name: 'Nueva tarea' })).toBeNull();
  });

  it('no aparece en el Asistente, para no tapar el campo de la pregunta', () => {
    nav.ruta = '/nova/asistente';
    render(<BotonAgregar />);
    expect(screen.queryByRole('button', { name: 'Agregar' })).toBeNull();
  });

  it('NavegacionNova reúne las tres piezas', () => {
    render(<NavegacionNova email="yo@ejemplo.com" />);
    expect(screen.getAllByRole('navigation', { name: 'Principal' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeTruthy();
  });
});

describe('Inicio: "Pregúntale a Nova"', () => {
  it('valida RN-02 en vivo y no envía una pregunta corta', () => {
    render(<PreguntaleANova />);
    const campo = screen.getByLabelText('Tu pregunta para Nova');
    fireEvent.change(campo, { target: { value: 'Agenda' } });
    expect(screen.getByText(MENSAJES.CONSULTA_MUY_CORTA)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Preguntar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('una pregunta válida lleva al Asistente con la pregunta en la URL', () => {
    render(<PreguntaleANova />);
    fireEvent.change(screen.getByLabelText('Tu pregunta para Nova'), { target: { value: '  ¿Qué tengo   esta semana? ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preguntar' }));
    expect(nav.push).toHaveBeenCalledWith(`/nova/asistente?pregunta=${encodeURIComponent('¿Qué tengo esta semana?')}`);
  });
});

describe('Chat con la pregunta que llega desde Inicio', () => {
  const ok = (respuesta: string) =>
    new Response(JSON.stringify({ ok: true, datos: { respuesta, fuentes: [], conversacionId: 'c1', guardada: true } }), { status: 200 });

  it('la envía al cargar, una sola vez, y quita ?pregunta= de la URL', async () => {
    window.history.pushState(null, '', '/nova/asistente?pregunta=hola');
    const fetchMock = vi.fn().mockResolvedValue(ok('Tienes 1 tarea.'));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<Chat preguntaInicial="¿Qué tengo esta semana?" />);
    rerender(<Chat preguntaInicial="¿Qué tengo esta semana?" />);
    expect(await screen.findByText('Tienes 1 tarea.')).toBeTruthy();
    expect(screen.getByText('¿Qué tengo esta semana?')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({ pregunta: '¿Qué tengo esta semana?' });
    expect(window.location.search).toBe('');
  });

  it('si no es válida, no la envía y la deja en el campo para corregirla', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<Chat preguntaInicial="Agenda" />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Tu pregunta') as HTMLTextAreaElement).value).toBe('Agenda');
  });
});
