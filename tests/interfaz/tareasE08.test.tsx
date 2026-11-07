// E08: grupos por categoría con contador, marca "Vencida" y campo de categoría con lista.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/nova/tareas',
}));

import { GruposTareas } from '@/components/nova/GruposTareas';
import { MiSemana } from '@/components/nova/inicio/MiSemana';
import { SelectorCategoria } from '@/components/nova/SelectorCategoria';
import type { Tarea } from '@/lib/dataService';

afterEach(cleanup);

const CATEGORIAS = [
  { nombre: 'General', color: 'gris' },
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
  ...extra,
});

describe('GruposTareas', () => {
  it('un grupo por categoría con color, nombre y contador completadas/total; la vencida lleva su marca', () => {
    render(
      <GruposTareas
        hoy="2026-11-07"
        categorias={CATEGORIAS}
        tareas={[
          tarea('1', 'Universidad', { estado: 'Completada', minutosInvertidos: 30 }),
          tarea('2', 'Universidad', { fechaLimite: '2026-11-05' }),
          tarea('3', 'Casa'),
          tarea('4', 'universidad'),
        ]}
      />,
    );
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos).toEqual(['Casa0/1, 0 de 1 completada', 'Universidad1/3, 1 de 3 completadas']);
    const uni = screen.getByRole('region', { name: /^Universidad/ });
    // Tabla del computador: sin la columna Categoría (ya está en el encabezado) y completadas al final.
    const tabla = within(uni).getByRole('table', { name: 'Tareas de Universidad' });
    expect(within(tabla).queryByRole('columnheader', { name: 'Categoría' })).toBeNull();
    expect(within(tabla).getAllByRole('rowheader').map((c) => c.textContent)).toEqual(['Tarea 2', 'Tarea 4', 'Tarea 1']);
    const fila2 = within(tabla).getByRole('rowheader', { name: 'Tarea 2' }).closest('tr') as HTMLElement;
    expect(within(fila2).getByText('Vencida')).toBeTruthy();
    // Una completada con fecha pasada o una pendiente futura no se marcan.
    expect(within(tabla).getAllByText('Vencida')).toHaveLength(1);
  });
});

describe('MiSemana', () => {
  it('las pendientes de días pasados llevan "Vencida"', () => {
    render(
      <MiSemana
        dias={['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']}
        hoy="2026-11-07"
        rango="2 – 8 de nov."
        porDia={{
          '2026-11-06': [tarea('v', 'Casa', { fechaLimite: '2026-11-06' })],
          '2026-11-07': [tarea('h', 'Casa', { fechaLimite: '2026-11-07' })],
        }}
        categorias={CATEGORIAS}
        anterior="/nova?semana=2026-10-26"
        siguiente="/nova?semana=2026-11-09"
        actual={null}
      />,
    );
    const columna = screen.getAllByRole('checkbox', { name: 'Completar «Tarea v»' })[0]?.closest('li') as HTMLElement;
    expect(within(columna).getByText('Vencida')).toBeTruthy();
    const deHoy = screen.getAllByRole('checkbox', { name: 'Completar «Tarea h»' })[0]?.closest('li') as HTMLElement;
    expect(within(deHoy).queryByText('Vencida')).toBeNull();
  });
});

function ConEstado({ inicial = 'General' }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <SelectorCategoria id="categoria" etiqueta="Categoría" valor={valor} onCambio={setValor} categorias={CATEGORIAS} />
      <output data-testid="valor">{valor}</output>
    </>
  );
}
const campo = () => screen.getByRole('combobox', { name: 'Categoría' });
const opciones = () => within(screen.getByRole('listbox', { hidden: true })).queryAllByRole('option', { hidden: true }).map((o) => o.textContent);

describe('SelectorCategoria (RB-33)', () => {
  it('al enfocar muestra todas las categorías con su color; elegir con el clic pone su nombre', () => {
    render(<ConEstado />);
    expect(campo().getAttribute('aria-expanded')).toBe('false');
    fireEvent.focus(campo());
    expect(campo().getAttribute('aria-expanded')).toBe('true');
    expect(opciones()).toEqual(['General', 'Universidad', 'Casa']);
    expect(screen.getByRole('option', { name: 'Universidad' }).querySelector('.bg-cat-azul')).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: 'Casa' }));
    expect(screen.getByTestId('valor').textContent).toBe('Casa');
    expect(campo().getAttribute('aria-expanded')).toBe('false');
  });

  it('se filtra al escribir y ofrece Crear "X" si no existe', () => {
    render(<ConEstado inicial="" />);
    fireEvent.change(campo(), { target: { value: 'uni' } });
    expect(opciones()).toEqual(['Universidad', 'Crear “uni”']);
    fireEvent.change(campo(), { target: { value: '  Viaje   largo ' } });
    expect(opciones()).toEqual(['Crear “Viaje largo”']);
    expect(screen.getByText('Se creará la categoría «Viaje largo» al guardar la tarea.')).toBeTruthy();
  });

  it('sin duplicar por mayúsculas ni espacios: " universidad " no ofrece crear', () => {
    render(<ConEstado inicial="" />);
    fireEvent.change(campo(), { target: { value: ' universidad ' } });
    expect(opciones()).toEqual(['Universidad']);
    expect(screen.queryByText(/Se creará/)).toBeNull();
  });

  it('con el teclado: flechas, Enter elige (sin enviar el formulario) y Escape cierra', () => {
    const enviar = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={enviar}>
        <ConEstado />
      </form>,
    );
    fireEvent.keyDown(campo(), { key: 'ArrowDown' }); // abre en la elegida (General)
    fireEvent.keyDown(campo(), { key: 'ArrowDown' });
    expect(campo().getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Universidad' }).id);
    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(screen.getByTestId('valor').textContent).toBe('Universidad');
    expect(enviar).not.toHaveBeenCalled();
    fireEvent.keyDown(campo(), { key: 'ArrowDown' });
    expect(campo().getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(campo(), { key: 'Escape' });
    expect(campo().getAttribute('aria-expanded')).toBe('false');
  });
});
