// E20b (commit 3): Tareas con vida: celebración al completar, "Completada · N min", avance por grupo, borde de
// color en el teléfono, vacíos amables y el botón que pasa a "Guardada".
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/nova/tareas' }));

import { Celebracion } from '@/components/nova/Celebracion';
import { FormularioMinutos } from '@/components/nova/FormularioMinutos';
import { GruposTareas } from '@/components/nova/GruposTareas';
import { InsigniaEstadoTarea } from '@/components/nova/InsigniaEstadoTarea';
import { Boton } from '@/components/ui/Boton';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { celebrar, EVENTO_CELEBRAR } from '@/lib/celebracion';
import type { Tarea } from '@/lib/dataService';
import { ListTodo } from 'lucide-react';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.values(nav).forEach((f) => f.mockReset());
});

const CATEGORIAS = [
  { nombre: 'Universidad', color: 'azul' },
  { nombre: 'Casa', color: 'verde' },
];
const tarea = (id: string, categoria: string, extra: Partial<Tarea> = {}): Tarea => ({
  id,
  titulo: `Tarea ${id}`,
  categoria,
  prioridad: 2,
  estado: 'Pendiente',
  minutosInvertidos: 0,
  fechaLimite: '2026-11-10',
  fechaCreacion: '2026-11-01',
  fechaCierre: null,
  horaInicio: null,
  horaFin: null,
  recordatorio: null,
  recordatorioEstado: null,
  ...extra,
});

describe('Celebración al completar', () => {
  it('el aviso aparece con el título y los minutos en una región status, y se va solo', () => {
    vi.useFakeTimers();
    render(<Celebracion />);
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');
    act(() => celebrar({ titulo: 'Leer capítulo tres', minutos: 95 }));
    expect(region.textContent).toContain('¡Tarea completada!');
    expect(region.textContent).toContain('Leer capítulo tres · 1 h 35 min');
    expect(region.querySelectorAll('.nova-destello')).toHaveLength(6);
    act(() => vi.advanceTimersByTime(3000));
    expect(region.textContent).toBe('');
  });

  it('FormularioMinutos celebra solo si el servidor confirmó', async () => {
    const oido = vi.fn();
    window.addEventListener(EVENTO_CELEBRAR, oido);
    const respuestas = [{ ok: false, error: { mensaje: 'No se pudo.' } }, { ok: true }];
    vi.stubGlobal('fetch', vi.fn(async () => { const c = respuestas.shift(); return { ok: c?.ok, json: async () => c }; }));
    const alTerminar = vi.fn();
    render(<FormularioMinutos id="t1" titulo="Ensayo" prefijo="p" alTerminar={alTerminar} alCancelar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Minutos dedicados'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByRole('alert');
    expect(oido).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(alTerminar).toHaveBeenCalled());
    expect(oido).toHaveBeenCalledTimes(1);
    expect((oido.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ titulo: 'Ensayo', minutos: 30 });
    window.removeEventListener(EVENTO_CELEBRAR, oido);
  });
});

describe('Lista de Tareas', () => {
  it('"Completada · 30 min" en la insignia; sin tiempo, solo "Completada"', () => {
    render(
      <>
        <InsigniaEstadoTarea estado="Completada" minutos={30} />
        <InsigniaEstadoTarea estado="Completada" minutos={0} />
        <InsigniaEstadoTarea estado="Pendiente" minutos={30} />
      </>,
    );
    expect(screen.getByText('Completada · 30 min')).toBeTruthy();
    expect(screen.getByText('Completada')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
  });

  it('cada grupo lleva una barra de avance del color de su categoría; las tarjetas, el borde de ese color', () => {
    const { container } = render(
      <GruposTareas
        tareas={[tarea('1', 'Universidad', { estado: 'Completada', minutosInvertidos: 45 }), tarea('2', 'Universidad'), tarea('3', 'Universidad'), tarea('4', 'Casa')]}
        categorias={CATEGORIAS}
        hoy="2026-11-05"
      />,
    );
    const barras = [...container.querySelectorAll('[data-avance-grupo] > span')] as HTMLElement[];
    expect(barras.map((b) => [b.style.width, b.className.match(/bg-cat-\w+/)?.[0]]).sort()).toEqual([
      ['0%', 'bg-cat-verde'],
      ['33%', 'bg-cat-azul'],
    ]);
    const tarjeta = container.querySelector('ul [data-tarea-id="4"]') as HTMLElement;
    expect(tarjeta.className).toContain('border-l-cat-verde');
    // El tiempo va en la insignia, en la tabla y en la tarjeta (ya no hay fila "Dedicado").
    const grupo = screen.getByRole('table', { name: 'Tareas de Universidad' });
    expect(within(grupo).getByText('Completada · 45 min')).toBeTruthy();
    expect(screen.queryByText('Dedicado')).toBeNull();
  });

  it('vacío amable con ícono decorativo', () => {
    const { container } = render(<EstadoVacio titulo="Aún no tienes tareas" descripcion="Registra tu primera tarea." icono={ListTodo} />);
    expect(screen.getByRole('heading', { name: 'Aún no tienes tareas' })).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"] svg')).toBeTruthy();
  });

  it('Boton listo: check, texto de listo y desactivado', () => {
    const { rerender } = render(<Boton type="submit">Guardar tarea</Boton>);
    expect((screen.getByRole('button', { name: 'Guardar tarea' }) as HTMLButtonElement).disabled).toBe(false);
    rerender(<Boton type="submit" listo textoListo="Guardada">Guardar tarea</Boton>);
    const b = screen.getByRole('button', { name: 'Guardada' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.querySelector('.nova-trazo-check')).toBeTruthy();
  });
});
