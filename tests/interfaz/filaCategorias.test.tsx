// E05b: categorías dentro de Tareas (fila con filtro, "+ Nueva", menú con "⋯", presión larga y clic derecho),
// selector de color, insignia en la tabla y el aviso del proveedor solo donde se le pregunta a Nova.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/nova/tareas' }));

import { FilaCategorias, PRESION_LARGA_MS } from '@/components/nova/FilaCategorias';
import { InsigniaCategoria } from '@/components/nova/InsigniaCategoria';
import { PreguntaleANova } from '@/components/nova/PreguntaleANova';
import { SelectorColor } from '@/components/nova/SelectorColor';
import { TablaTareas } from '@/components/nova/TablaTareas';
import type { Categoria, Tarea } from '@/lib/dataService';
import { AVISO_PROVEEDOR_CORTO } from '@/lib/reglas/consulta';
import { hrefTareas } from '@/lib/rutasTareas';

const CATEGORIAS: Categoria[] = [
  { id: 'g', nombre: 'General', color: 'gris', tareas: 1 },
  { id: 'c', nombre: 'Casa', color: 'terracota', tareas: 2 },
];
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });
const fila = () => screen.getByRole('navigation', { name: 'Filtrar por categoría' });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Object.values(nav).forEach((f) => f.mockReset());
});

describe('hrefTareas', () => {
  it('combina la vista (E08) y la categoría en la URL; "todas" no va en la URL', () => {
    expect(hrefTareas(undefined, null)).toBe('/nova/tareas');
    expect(hrefTareas('todas', null)).toBe('/nova/tareas');
    expect(hrefTareas('hoy', null)).toBe('/nova/tareas?vista=hoy');
    expect(hrefTareas('importantes', 'Mi casa')).toBe('/nova/tareas?vista=importantes&categoria=Mi+casa');
  });
});

describe('FilaCategorias', () => {
  it('"Todas", General, las del usuario y "+ Nueva"; cada una filtra conservando la vista', () => {
    render(<FilaCategorias categorias={CATEGORIAS} activa={null} vista="hoy" />);
    const enlaces = within(fila()).getAllByRole('link');
    expect(enlaces.map((a) => a.textContent)).toEqual(['Todas', 'General', 'Casa']);
    expect(enlaces[0]?.getAttribute('aria-current')).toBe('page');
    expect(enlaces[2]?.getAttribute('href')).toBe('/nova/tareas?vista=hoy&categoria=Casa');
    expect(within(fila()).getByRole('button', { name: 'Nueva' })).toBeTruthy();
    expect(within(fila()).queryByRole('button', { name: /Opciones/ })).toBeNull(); // "⋯" solo en la elegida
  });

  it('la elegida queda marcada y muestra "⋯"', () => {
    render(<FilaCategorias categorias={CATEGORIAS} activa="Casa" />);
    expect(within(fila()).getByRole('link', { name: 'Casa' }).getAttribute('aria-current')).toBe('page');
    expect(within(fila()).getByRole('link', { name: 'Todas' }).getAttribute('aria-current')).toBeNull();
    expect(within(fila()).getByRole('button', { name: 'Opciones de la categoría Casa' })).toBeTruthy();
  });

  it('"+ Nueva" crea con nombre y color sin salir de Tareas; la repetida muestra el mensaje exacto', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: false, error: { mensaje: 'Ya existe una categoría con ese nombre.' } }, 409))
      .mockResolvedValueOnce(json({ ok: true, datos: { id: 'u', nombre: 'Universidad', color: 'ambar', tareas: 0 } }, 201));
    vi.stubGlobal('fetch', f);
    render(<FilaCategorias categorias={CATEGORIAS} activa={null} />);
    fireEvent.click(within(fila()).getByRole('button', { name: 'Nueva' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva categoría' });
    expect((within(dialogo).getByRole('radio', { name: 'Ámbar' }) as HTMLInputElement).checked).toBe(true); // siguiente libre
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'casa' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear categoría' }));
    expect((await within(dialogo).findByRole('alert')).textContent).toBe('Ya existe una categoría con ese nombre.');
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Universidad' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear categoría' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(JSON.parse(f.mock.calls[1]?.[1].body)).toEqual({ nombre: 'Universidad', color: 'ambar' });
    expect(nav.refresh).toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Se creó la categoría «Universidad».');
  });

  it('al escribir el nombre, el foco se queda en el campo (no salta a "Cerrar" ni a "+ Nueva")', () => {
    render(<FilaCategorias categorias={CATEGORIAS} activa={null} />);
    fireEvent.click(within(fila()).getByRole('button', { name: 'Nueva' }));
    const campo = within(screen.getByRole('dialog')).getByLabelText('Nombre') as HTMLInputElement;
    expect(document.activeElement).toBe(campo); // el foco entra al campo, no al botón "Cerrar"
    fireEvent.change(campo, { target: { value: 'U' } });
    expect(document.activeElement).toBe(campo);
    fireEvent.change(campo, { target: { value: 'Universidad' } });
    expect(document.activeElement).toBe(campo);
    expect(campo.value).toBe('Universidad');
  });

  it('menú de General: "por defecto" y solo "Cambiar color"', () => {
    render(<FilaCategorias categorias={CATEGORIAS} activa="General" />);
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de la categoría General' }));
    const dialogo = screen.getByRole('dialog', { name: 'General' });
    expect(within(dialogo).getByText('Por defecto · 1 tarea')).toBeTruthy();
    expect(within(dialogo).getAllByRole('button').map((b) => b.textContent)).toEqual(['', 'Cambiar color']); // "" = Cerrar (ícono)
  });

  it('renombrar la categoría elegida actualiza el filtro con el nombre nuevo', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, datos: { id: 'c', nombre: 'Hogar', color: 'terracota', tareas: 2 } }));
    vi.stubGlobal('fetch', f);
    render(<FilaCategorias categorias={CATEGORIAS} activa="Casa" vista="hoy" />);
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de la categoría Casa' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Renombrar' }));
    const dialogo = screen.getByRole('dialog', { name: 'Renombrar «Casa»' });
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Hogar' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/nova/tareas?vista=hoy&categoria=Hogar'));
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/categorias/c');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ nombre: 'Hogar' });
  });

  it('cambiar color envía solo el color', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, datos: { ...CATEGORIAS[1], color: 'azul' } }));
    vi.stubGlobal('fetch', f);
    render(<FilaCategorias categorias={CATEGORIAS} activa="Casa" />);
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de la categoría Casa' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cambiar color' }));
    const dialogo = screen.getByRole('dialog', { name: 'Color de «Casa»' });
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Azul' }));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ color: 'azul' });
  });

  it('eliminar pide confirmación, avisa que sus tareas pasan a General y vuelve a "Todas"', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, datos: { id: 'c', tareasMovidas: 2 } }));
    vi.stubGlobal('fetch', f);
    render(<FilaCategorias categorias={CATEGORIAS} activa="Casa" />);
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de la categoría Casa' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar «Casa»' });
    expect(within(dialogo).getByText('¿Eliminar la categoría «Casa»? Sus 2 tareas pasarán a General.')).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/nova/tareas'));
    expect(f.mock.calls[0]?.[1].method).toBe('DELETE');
  });

  it('el diálogo se cierra con Escape y el foco vuelve a quien lo abrió', () => {
    render(<FilaCategorias categorias={CATEGORIAS} activa="Casa" />);
    const opciones = screen.getByRole('button', { name: 'Opciones de la categoría Casa' });
    fireEvent.click(opciones);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opciones);
  });

  it('dejar presionada una categoría abre su menú (y no sigue el enlace); deslizar no lo abre', () => {
    // jsdom no trae PointerEvent: sin él, el evento simulado llega sin coordenadas.
    vi.stubGlobal('PointerEvent', window.PointerEvent ?? MouseEvent);
    vi.useFakeTimers();
    render(<FilaCategorias categorias={CATEGORIAS} activa={null} />);
    const casa = within(fila()).getByRole('link', { name: 'Casa' });

    fireEvent.pointerDown(casa, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(casa, { clientX: 60, clientY: 10 }); // desliza la fila
    act(() => vi.advanceTimersByTime(PRESION_LARGA_MS + 50));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.pointerDown(casa, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(PRESION_LARGA_MS + 50));
    expect(screen.getByRole('dialog', { name: 'Casa' })).toBeTruthy();
    const clic = new MouseEvent('click', { bubbles: true, cancelable: true });
    casa.dispatchEvent(clic);
    expect(clic.defaultPrevented).toBe(true);
  });

  it('al soltar el dedo tras la presión larga, el clic sobre el fondo no cierra el menú; un toque en el fondo sí', () => {
    vi.stubGlobal('PointerEvent', window.PointerEvent ?? MouseEvent);
    vi.useFakeTimers();
    render(<FilaCategorias categorias={CATEGORIAS} activa={null} />);
    fireEvent.pointerDown(within(fila()).getByRole('link', { name: 'Casa' }), { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(PRESION_LARGA_MS + 50));
    const fondo = screen.getByTestId('fondo-dialogo');
    fireEvent.click(fondo); // el clic de soltar el dedo cae sobre el fondo recién aparecido
    expect(screen.getByRole('dialog', { name: 'Casa' })).toBeTruthy();
    fireEvent.pointerDown(fondo);
    fireEvent.click(fondo);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clic derecho en una categoría también abre su menú', () => {
    render(<FilaCategorias categorias={CATEGORIAS} activa={null} />);
    fireEvent.contextMenu(within(fila()).getByRole('link', { name: 'General' }));
    expect(screen.getByRole('dialog', { name: 'General' })).toBeTruthy();
  });
});

describe('selector de color, insignia y tabla', () => {
  it('los 8 colores son opciones nativas con su nombre', () => {
    const alCambiar = vi.fn();
    render(<SelectorColor nombre="c" valor="azul" alCambiar={alCambiar} />);
    const opciones = within(screen.getByRole('group', { name: 'Color' })).getAllByRole('radio');
    expect(opciones.map((o) => (o.closest('label') as HTMLElement).textContent)).toEqual([
      'Terracota', 'Ámbar', 'Oliva', 'Verde', 'Azul', 'Violeta', 'Rosa', 'Gris',
    ]);
    fireEvent.click(screen.getByRole('radio', { name: 'Rosa' }));
    expect(alCambiar).toHaveBeenCalledWith('rosa');
  });

  it('la insignia muestra el nombre y el punto de color es decorativo', () => {
    const { container } = render(<InsigniaCategoria nombre="Casa" color="terracota" />);
    expect(screen.getByText('Casa')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')?.className).toContain('bg-cat-terracota');
  });

  it('en la tabla, cada tarea usa el color de su categoría (sin registro, gris)', () => {
    const tarea = (id: string, categoria: string): Tarea => ({
      id, titulo: `T ${id}`, categoria, prioridad: 2, estado: 'Pendiente', minutosInvertidos: 0,
      fechaLimite: '2099-01-01', fechaCreacion: '2026-11-07', fechaCierre: null, horaInicio: null, horaFin: null,
    });
    const { container } = render(<TablaTareas tareas={[tarea('1', 'casa'), tarea('2', 'Sin registrar')]} categorias={CATEGORIAS} />);
    const puntos = [...container.querySelectorAll('table [aria-hidden="true"][class*="bg-cat-"]')].map((p) => p.className);
    expect(puntos[0]).toContain('bg-cat-terracota');
    expect(puntos[1]).toContain('bg-cat-gris');
  });
});

describe('B-46: el aviso del proveedor solo donde se le pregunta a Nova', () => {
  const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8');

  it('ya no está en el layout de Nova; sí en el Asistente', () => {
    expect(leer('src/app/nova/layout.tsx')).not.toMatch(/Aviso|proveedor/);
    expect(leer('src/app/nova/asistente/page.tsx')).toContain('AVISO_PROVEEDOR');
  });

  it('"Pregúntale a Nova" lleva la línea corta', () => {
    render(<PreguntaleANova />);
    expect(screen.getByText(AVISO_PROVEEDOR_CORTO)).toBeTruthy();
  });

  it('Productividad no lo lleva y la pestaña Web de Fuentes conserva su subtítulo', () => {
    expect(leer('src/app/nova/productividad/page.tsx')).not.toMatch(/AVISO_PROVEEDOR|proveedor del asistente/);
    expect(leer('src/app/nova/fuentes/page.tsx')).toContain('al proveedor del asistente');
  });
});
