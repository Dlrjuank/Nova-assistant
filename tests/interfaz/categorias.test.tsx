// E05: bloque Categorías de Configuración, selector de color e insignia de categoría.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh, push: vi.fn(), replace: vi.fn() }) }));

import { CategoriasConfig } from '@/components/nova/CategoriasConfig';
import { InsigniaCategoria } from '@/components/nova/InsigniaCategoria';
import { SelectorColor } from '@/components/nova/SelectorColor';
import { TablaTareas } from '@/components/nova/TablaTareas';
import type { Categoria, Tarea } from '@/lib/dataService';

const CATEGORIAS: Categoria[] = [
  { id: 'g', nombre: 'General', color: 'gris', tareas: 1 },
  { id: 'c', nombre: 'Casa', color: 'terracota', tareas: 2 },
];
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  nav.refresh.mockReset();
});

describe('SelectorColor e InsigniaCategoria', () => {
  it('los 8 colores son opciones con su nombre; la elegida queda marcada', () => {
    const alCambiar = vi.fn();
    render(<SelectorColor nombre="c" valor="azul" alCambiar={alCambiar} />);
    const grupo = screen.getByRole('group', { name: 'Color' });
    const opciones = within(grupo).getAllByRole('radio');
    expect(opciones.map((o) => (o.closest('label') as HTMLElement).textContent)).toEqual([
      'Terracota', 'Ámbar', 'Oliva', 'Verde', 'Azul', 'Violeta', 'Rosa', 'Gris',
    ]);
    expect((screen.getByRole('radio', { name: 'Azul' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Rosa' }));
    expect(alCambiar).toHaveBeenCalledWith('rosa');
  });

  it('la insignia muestra el nombre en texto y el punto de color es decorativo', () => {
    const { container } = render(<InsigniaCategoria nombre="Casa" color="terracota" />);
    expect(screen.getByText('Casa')).toBeTruthy();
    const punto = container.querySelector('[aria-hidden="true"]');
    expect(punto?.className).toContain('bg-cat-terracota');
  });

  it('en Tareas, cada tarea muestra su categoría con el color registrado (sin registro, gris)', () => {
    const tarea = (id: string, categoria: string): Tarea => ({
      id, titulo: `T ${id}`, categoria, prioridad: 2, estado: 'Pendiente', minutosInvertidos: 0,
      fechaLimite: '2099-01-01', fechaCreacion: '2026-11-07', fechaCierre: null,
    });
    const { container } = render(<TablaTareas tareas={[tarea('1', 'casa'), tarea('2', 'Sin registrar')]} categorias={CATEGORIAS} />);
    const puntos = [...container.querySelectorAll('table [aria-hidden="true"]')].map((p) => p.className);
    expect(puntos[0]).toContain('bg-cat-terracota');
    expect(puntos[1]).toContain('bg-cat-gris');
  });
});

describe('CategoriasConfig', () => {
  it('lista las categorías con su número de tareas; General no tiene "Eliminar"', () => {
    render(<CategoriasConfig categorias={CATEGORIAS} />);
    const lista = screen.getByRole('list', { name: 'Tus categorías' });
    expect(within(lista).getByText('General')).toBeTruthy();
    expect(within(lista).getByText('1 tarea')).toBeTruthy();
    expect(within(lista).getByText('2 tareas')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Eliminar la categoría General' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Eliminar la categoría Casa' })).toBeTruthy();
  });

  it('crear: propone el siguiente color libre, envía nombre y color y refresca', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, datos: { id: 'u', nombre: 'Universidad', color: 'ambar', tareas: 0 } }, 201));
    vi.stubGlobal('fetch', f);
    render(<CategoriasConfig categorias={CATEGORIAS} />);
    const form = screen.getByRole('form', { name: 'Nueva categoría' });
    expect((within(form).getByRole('radio', { name: 'Ámbar' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'Universidad' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Agregar categoría' }));
    expect((await screen.findByRole('status')).textContent).toBe('Se creó la categoría «Universidad».');
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/categorias');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ nombre: 'Universidad', color: 'ambar' });
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('un nombre repetido muestra el mensaje exacto del servidor (RB-02)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ok: false, error: { codigo: 'CATEGORIA_DUPLICADA', mensaje: 'Ya existe una categoría con ese nombre.' } }, 409)));
    render(<CategoriasConfig categorias={CATEGORIAS} />);
    const form = screen.getByRole('form', { name: 'Nueva categoría' });
    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'casa' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Agregar categoría' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Ya existe una categoría con ese nombre.');
  });

  it('editar General solo permite cambiar el color', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, datos: { ...CATEGORIAS[0], color: 'azul' } }));
    vi.stubGlobal('fetch', f);
    render(<CategoriasConfig categorias={CATEGORIAS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar la categoría General' }));
    const form = screen.getByRole('form', { name: 'Editar la categoría General' });
    expect(within(form).queryByLabelText('Nombre')).toBeNull();
    expect(within(form).getByText(/General no se puede renombrar ni eliminar/)).toBeTruthy();
    fireEvent.click(within(form).getByRole('radio', { name: 'Azul' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/categorias/g');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ color: 'azul' });
  });

  it('renombrar envía nombre y color', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, datos: { ...CATEGORIAS[1], nombre: 'Hogar' } }));
    vi.stubGlobal('fetch', f);
    render(<CategoriasConfig categorias={CATEGORIAS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar la categoría Casa' }));
    const form = screen.getByRole('form', { name: 'Editar la categoría Casa' });
    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'Hogar' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ nombre: 'Hogar', color: 'terracota' });
  });

  it('eliminar pide confirmación, avisa que sus tareas pasan a General y se puede cancelar', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, datos: { id: 'c', tareasMovidas: 2 } }));
    vi.stubGlobal('fetch', f);
    render(<CategoriasConfig categorias={CATEGORIAS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la categoría Casa' }));
    expect(screen.getByText('¿Eliminar la categoría «Casa»? Sus 2 tareas pasarán a General.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(f).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la categoría Casa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/categorias/c');
    expect(f.mock.calls[0]?.[1].method).toBe('DELETE');
  });
});
