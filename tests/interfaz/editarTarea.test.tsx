// E09: formulario en modo edición, enlaces "Editar" y vuelta a la pantalla de origen.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/nova' }));

import { AccionesTarea } from '@/components/nova/AccionesTarea';
import { EnlaceEditarTarea } from '@/components/nova/EnlaceEditarTarea';
import { FormularioTarea } from '@/components/nova/FormularioTarea';
import { CasillaTarea } from '@/components/nova/inicio/CasillaTarea';
import { MENSAJES } from '@/lib/reglas/errores';
import { hrefEditarTarea, rutaVolverSegura } from '@/lib/rutasTareas';

const ID = '22222222-2222-4222-8222-222222222222';
const TAREA = { id: ID, titulo: 'Leer capítulo', categoria: 'Universidad', prioridad: 3, fechaLimite: '2026-11-20', horaInicio: '08:00', horaFin: '09:30' };
const respuesta = (cuerpo: unknown, ok = true) => ({ ok, json: async () => cuerpo });
const f = vi.fn();
const valor = (etiqueta: string) => (screen.getByLabelText(etiqueta) as HTMLInputElement).value;

beforeEach(() => {
  f.mockReset();
  vi.stubGlobal('fetch', f);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.values(nav).forEach((n) => n.mockReset());
});

describe('rutas de editar', () => {
  it('solo acepta volver a rutas internas de Nova', () => {
    for (const buena of ['/nova', '/nova/tareas?vista=hoy', '/nova/calendario?mes=2026-11&dia=2026-11-20', '/nova?semana=2026-11-02']) {
      expect(rutaVolverSegura(buena)).toBe(buena);
    }
    for (const mala of ['https://malo.com', '//malo.com', '/novatos', '/login', '/nova\\..\\x', undefined, ['/nova']]) {
      expect(rutaVolverSegura(mala)).toBe('/nova/tareas');
    }
  });

  it('el enlace codifica la pantalla de origen', () => {
    expect(hrefEditarTarea(ID)).toBe(`/nova/tareas/${ID}/editar`);
    expect(hrefEditarTarea(ID, '/nova/tareas?vista=hoy&categoria=Casa')).toBe(`/nova/tareas/${ID}/editar?volver=%2Fnova%2Ftareas%3Fvista%3Dhoy%26categoria%3DCasa`);
  });
});

describe('FormularioTarea en modo edición', () => {
  it('abre lleno, con "Guardar cambios"; hace PATCH y vuelve a la pantalla de origen', async () => {
    f.mockResolvedValue(respuesta({ ok: true, datos: {} }));
    render(<FormularioTarea tarea={TAREA} volver="/nova/tareas?vista=hoy" categorias={[{ nombre: 'Universidad', color: 'azul' }]} />);
    expect(valor('Título')).toBe('Leer capítulo');
    expect(valor('Categoría')).toBe('Universidad');
    expect(valor('Prioridad')).toBe('3');
    expect(valor('Fecha límite')).toBe('2026-11-20');
    expect(valor('Desde')).toBe('08:00');
    expect(valor('Hasta')).toBe('09:30');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Leer capítulo 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/nova/tareas?vista=hoy'));
    expect(f.mock.calls[0]?.[0]).toBe(`/api/nova/tareas/${ID}`);
    expect(f.mock.calls[0]?.[1].method).toBe('PATCH');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ titulo: 'Leer capítulo 2', categoria: 'Universidad', prioridad: 3, fechaLimite: '2026-11-20', horaInicio: '08:00', horaFin: '09:30', recordatorio: null });
  });

  it('"Cancelar" vuelve sin llamar al servidor', () => {
    render(<FormularioTarea tarea={TAREA} volver="/nova" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(nav.push).toHaveBeenCalledWith('/nova');
    expect(f).not.toHaveBeenCalled();
  });

  it('muestra los mismos errores que crear y el del servidor; no navega', async () => {
    render(<FormularioTarea tarea={TAREA} volver="/nova" />);
    fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2026-02-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText(MENSAJES.FECHA_INVALIDA)).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2026-11-21' } });
    f.mockResolvedValue(respuesta({ ok: false, error: { mensaje: 'La tarea ya está completada.' } }, false));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('La tarea ya está completada.')).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });
});

describe('acción Editar', () => {
  it('solo en las pendientes de Tareas', () => {
    const { rerender } = render(<AccionesTarea id={ID} titulo="T" completada={false} prefijo="tarjeta" />);
    expect(screen.getByRole('link', { name: 'Editar tarea: T' }).textContent).toBe('Editar');
    rerender(<AccionesTarea id={ID} titulo="T" completada prefijo="tarjeta" />);
    expect(screen.queryByRole('link', { name: 'Editar tarea: T' })).toBeNull();
  });

  it('solo en las pendientes de la casilla (Inicio y Calendario)', () => {
    const tarea = { id: ID, titulo: 'T', categoria: 'Casa', prioridad: 2, estado: 'Pendiente' };
    const { rerender } = render(<CasillaTarea tarea={tarea} color="verde" prefijo="p" />);
    expect(screen.getByRole('link', { name: 'Editar tarea: T' })).toBeTruthy();
    rerender(<CasillaTarea tarea={{ ...tarea, estado: 'Completada' }} color="verde" prefijo="p" />);
    expect(screen.queryByRole('link', { name: 'Editar tarea: T' })).toBeNull();
  });

  it('en las columnas, el lápiz va siempre en la línea de la prioridad y la categoría tiene la suya', () => {
    const tarea = { id: ID, titulo: 'T', categoria: 'Universidad', prioridad: 2, estado: 'Pendiente' };
    render(<CasillaTarea tarea={tarea} color="azul" prefijo="p" compacta />);
    const lapiz = screen.getByRole('link', { name: 'Editar tarea: T' });
    expect(lapiz.parentElement?.textContent).toBe('Media');
    expect(lapiz.parentElement?.textContent).not.toContain('Universidad');
    expect(screen.getByTitle('Universidad').className).toContain('px-1.5');
  });

  it('fuera de las columnas (teléfono), la categoría conserva su tamaño', () => {
    const tarea = { id: ID, titulo: 'T', categoria: 'Universidad', prioridad: 2, estado: 'Pendiente' };
    render(<CasillaTarea tarea={tarea} color="azul" prefijo="p" />);
    expect(screen.getByTitle('Universidad').className).toContain('px-2.5');
  });

  it('al tocarlo lleva la pantalla actual, o la que se le indica', () => {
    window.history.pushState({}, '', '/nova/tareas?vista=hoy');
    const { rerender } = render(<EnlaceEditarTarea id={ID} titulo="T" />);
    fireEvent.click(screen.getByRole('link', { name: 'Editar tarea: T' }));
    expect(nav.push).toHaveBeenLastCalledWith(hrefEditarTarea(ID, '/nova/tareas?vista=hoy'));
    rerender(<EnlaceEditarTarea id={ID} titulo="T" volver="/nova/calendario?mes=2026-11&dia=2026-11-20" />);
    fireEvent.click(screen.getByRole('link', { name: 'Editar tarea: T' }));
    expect(nav.push).toHaveBeenLastCalledWith(hrefEditarTarea(ID, '/nova/calendario?mes=2026-11&dia=2026-11-20'));
  });
});
