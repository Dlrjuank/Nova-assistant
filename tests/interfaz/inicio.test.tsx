// E06: Inicio (casilla con el diálogo de minutos, Mi semana, Progreso semanal y Prioridades de hoy).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/nova' }));

import { FormularioTarea } from '@/components/nova/FormularioTarea';
import { CasillaTarea } from '@/components/nova/inicio/CasillaTarea';
import { MiSemana } from '@/components/nova/inicio/MiSemana';
import { PrioridadesHoy } from '@/components/nova/inicio/PrioridadesHoy';
import { ProgresoSemanal } from '@/components/nova/inicio/ProgresoSemanal';

const CATEGORIAS = [{ nombre: 'Casa', color: 'terracota' }];
const tarea = (id: string, estado = 'Pendiente', titulo = `Tarea ${id}`, prioridad = 2) => ({ id, titulo, categoria: 'Casa', prioridad, estado });
const DIAS = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.values(nav).forEach((f) => f.mockReset());
});

describe('CasillaTarea', () => {
  it('marcar una pendiente abre el diálogo de minutos; cancelar no cambia nada', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<CasillaTarea tarea={tarea('1')} color="terracota" prefijo="p" />);
    const casilla = screen.getByRole('checkbox', { name: 'Completar «Tarea 1»' }) as HTMLInputElement;
    fireEvent.click(casilla);
    const dialogo = screen.getByRole('dialog', { name: 'Completar «Tarea 1»' });
    expect(within(dialogo).getByLabelText('Minutos dedicados')).toBeTruthy();
    expect(casilla.checked).toBe(false); // no se marca sola
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(casilla.checked).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('confirmar completa con los minutos (la misma ruta que en Tareas) y refresca', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, datos: {} }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    render(<CasillaTarea tarea={tarea('1')} color="terracota" prefijo="p" />);
    fireEvent.click(screen.getByRole('checkbox'));
    const dialogo = screen.getByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Minutos dedicados'), { target: { value: '45' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/tareas/1/completar');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ minutos: 45 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('en las columnas del computador (compacta) muestra lo mismo que en el teléfono: categoría y prioridad', () => {
    render(<CasillaTarea tarea={tarea('1', 'Pendiente', 'Pagar luz', 3)} color="terracota" prefijo="p" compacta />);
    expect(screen.getByText('Casa')).toBeTruthy();
    expect(screen.getByText('Alta')).toBeTruthy();
  });

  it('la categoría no se sale de la columna: se corta con "…" y el nombre completo queda en title', () => {
    const largo = 'Universidad Nacional de Colombia';
    render(<CasillaTarea tarea={{ ...tarea('1'), categoria: largo }} color="azul" prefijo="p" compacta />);
    const nombre = screen.getByText(largo);
    expect(nombre.className).toContain('truncate');
    expect(nombre.parentElement?.className).toContain('max-w-full');
    expect(nombre.parentElement?.getAttribute('title')).toBe(largo);
  });

  it('una completada se ve marcada y no se puede desmarcar', () => {
    render(<CasillaTarea tarea={tarea('1', 'Completada')} color="terracota" prefijo="p" />);
    const casilla = screen.getByRole('checkbox', { name: 'Tarea 1: completada' }) as HTMLInputElement;
    expect(casilla.checked).toBe(true);
    expect(casilla.disabled).toBe(true);
  });
});

describe('MiSemana', () => {
  const props = {
    dias: DIAS,
    porDia: Object.fromEntries(DIAS.map((d) => [d, d === '2026-11-04' ? [tarea('a'), tarea('b', 'Completada')] : []])),
    hoy: '2026-11-04',
    rango: '2 – 8 de nov.',
    categorias: CATEGORIAS,
    anterior: '/nova?semana=2026-10-26',
    siguiente: '/nova?semana=2026-11-09',
  };

  it('rango, flechas de semana y "Esta semana" solo si se ve otra semana', () => {
    const { rerender } = render(<MiSemana {...props} actual={null} />);
    expect(screen.getByText('2 – 8 de nov.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Semana anterior' }).getAttribute('href')).toBe('/nova?semana=2026-10-26');
    expect(screen.getByRole('link', { name: 'Semana siguiente' }).getAttribute('href')).toBe('/nova?semana=2026-11-09');
    expect(screen.queryByRole('link', { name: 'Esta semana' })).toBeNull();
    rerender(<MiSemana {...props} actual="/nova" />);
    expect(screen.getByRole('link', { name: 'Esta semana' }).getAttribute('href')).toBe('/nova');
  });

  it('computador: 7 columnas con las tareas por fecha límite', () => {
    render(<MiSemana {...props} actual={null} />);
    const miercoles = screen.getByRole('listitem', { name: 'miércoles 4 de nov.' });
    expect(within(miercoles).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(screen.getByRole('listitem', { name: 'lunes 2 de nov.' })).getByText('Sin tareas')).toBeTruthy();
  });

  it('teléfono: 7 días para elegir; empieza en hoy y al elegir otro muestra sus tareas', () => {
    render(<MiSemana {...props} actual={null} />);
    const grupo = screen.getByRole('group', { name: 'Elegir día' });
    const botones = within(grupo).getAllByRole('button');
    expect(botones).toHaveLength(7);
    const hoy = within(grupo).getByRole('button', { name: 'miércoles 4 de nov., 2 tareas' });
    expect(hoy.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('miércoles 4 de nov.');
    fireEvent.click(within(grupo).getByRole('button', { name: 'lunes 2 de nov., sin tareas' }));
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('lunes 2 de nov.');
  });
});

describe('ProgresoSemanal y PrioridadesHoy', () => {
  it('el porcentaje va también en texto, con los contadores', () => {
    render(<ProgresoSemanal progreso={{ total: 4, completadas: 2, pendientes: 2, porcentaje: 50 }} />);
    expect(screen.getByText(/50 %/).textContent).toContain('de las tareas de la semana completadas');
    expect(screen.getByText('Completadas').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Total').nextElementSibling?.textContent).toBe('4');
  });

  it('sin tareas en la semana lo dice', () => {
    render(<ProgresoSemanal progreso={{ total: 0, completadas: 0, pendientes: 0, porcentaje: 0 }} />);
    expect(screen.getByText('No hay tareas con fecha límite en esta semana.')).toBeTruthy();
  });

  it('"Agregar" abre el formulario con la fecha de hoy; las vencidas enlazan a Tareas', () => {
    render(<PrioridadesHoy tareas={[tarea('1', 'Pendiente', 'Pagar luz', 3)]} hoy="2026-11-07" vencidas={1} categorias={CATEGORIAS} />);
    expect(screen.getByRole('link', { name: 'Agregar' }).getAttribute('href')).toBe('/nova/tareas/nueva?fecha=2026-11-07');
    expect(screen.getByRole('checkbox', { name: 'Completar «Pagar luz»' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '1 tarea vencida' }).getAttribute('href')).toBe('/nova/tareas?estado=Pendiente');
  });

  it('sin tareas para hoy ni vencidas', () => {
    render(<PrioridadesHoy tareas={[]} hoy="2026-11-07" vencidas={0} categorias={CATEGORIAS} />);
    expect(screen.getByText('No tienes tareas pendientes para hoy.')).toBeTruthy();
    expect(screen.queryByText(/vencida/)).toBeNull();
  });
});

describe('FormularioTarea con ?fecha=', () => {
  it('la fecha que llega desde Inicio queda puesta en el campo', () => {
    render(<FormularioTarea fechaInicial="2026-11-07" />);
    expect((screen.getByLabelText('Fecha límite') as HTMLInputElement).value).toBe('2026-11-07');
  });
});
