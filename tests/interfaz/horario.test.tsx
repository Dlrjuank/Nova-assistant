// RB-34 (E06b): horario en el formulario de tarea, en la casilla de Inicio y en la tabla de Tareas.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/nova/tareas/nueva' }));

import { FormularioTarea } from '@/components/nova/FormularioTarea';
import { CasillaTarea } from '@/components/nova/inicio/CasillaTarea';
import { TablaTareas } from '@/components/nova/TablaTareas';
import type { Tarea } from '@/lib/dataService';

const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.values(nav).forEach((f) => f.mockReset());
});

describe('formulario de tarea con horario', () => {
  it('"Desde" y "Hasta" son opcionales, con el selector de hora del navegador', () => {
    render(<FormularioTarea />);
    expect(screen.getByRole('group', { name: 'Horario (opcional)' })).toBeTruthy();
    expect((screen.getByLabelText('Desde') as HTMLInputElement).type).toBe('time');
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).type).toBe('time');
  });

  it('"Hasta" sin "Desde" o antes de "Desde": mensaje exacto y no se envía', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<FormularioTarea fechaInicial="2099-01-01" />);
    escribir('Título', 'Estudiar');
    escribir('Hasta', '09:00');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    expect(screen.getByText('La hora de fin necesita una hora de inicio.')).toBeTruthy();
    escribir('Desde', '10:00');
    expect(screen.getByText('La hora de fin debe ser después de la de inicio.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    expect(f).not.toHaveBeenCalled();
  });

  it('envía el horario con la tarea', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, datos: {} }), { status: 201 }));
    vi.stubGlobal('fetch', f);
    render(<FormularioTarea fechaInicial="2099-01-01" />);
    escribir('Título', 'Estudiar');
    escribir('Desde', '08:00');
    escribir('Hasta', '09:30');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toMatchObject({ horaInicio: '08:00', horaFin: '09:30' });
  });
});

describe('el horario se ve donde está la tarea', () => {
  it('casilla de Inicio: "8:00 – 9:30" bajo el título, dentro de la etiqueta', () => {
    render(<CasillaTarea tarea={{ id: '1', titulo: 'Clase', categoria: 'General', prioridad: 2, estado: 'Pendiente', horaInicio: '08:00', horaFin: '09:30' }} color="gris" prefijo="p" />);
    expect(screen.getByText('8:00 – 9:30')).toBeTruthy();
    expect(screen.getByRole('checkbox').getAttribute('aria-label')).toBe('Completar «Clase»');
    expect(screen.getByText('8:00 – 9:30').closest('label')).toBeTruthy();
  });

  it('tabla de Tareas: el horario junto a la fecha límite; sin horario no muestra nada extra', () => {
    const tarea = (id: string, horaInicio: string | null, horaFin: string | null): Tarea => ({
      id, titulo: `T${id}`, categoria: 'General', prioridad: 2, estado: 'Pendiente', minutosInvertidos: 0,
      fechaLimite: '2099-01-01', fechaCreacion: '2026-11-07', fechaCierre: null, horaInicio, horaFin, recordatorio: null, recordatorioEstado: null,
    });
    render(<TablaTareas tareas={[tarea('1', '14:00', null), tarea('2', null, null)]} />);
    expect(screen.getAllByText('14:00').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\/01\/2099 · 14:00/).length).toBe(1); // tarjeta del teléfono
  });
});
