import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ruta = vi.hoisted(() => ({ actual: '/nova/tareas' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => ruta.actual,
}));

import { InsigniaEstadoTarea } from '@/components/nova/InsigniaEstadoTarea';
import { InsigniaPrioridad } from '@/components/nova/InsigniaPrioridad';
import { TablaTareas } from '@/components/nova/TablaTareas';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import type { Tarea } from '@/lib/dataService';

afterEach(cleanup);

const TAREA: Tarea = {
  id: 't1',
  titulo: 'Renovar pasaporte',
  categoria: 'Trámites',
  prioridad: 3,
  estado: 'Pendiente',
  minutosInvertidos: 0,
  fechaLimite: '2026-03-10',
  fechaCreacion: '2026-03-01',
  fechaCierre: null, horaInicio: null, horaFin: null,
};

describe('insignias', () => {
  it('la prioridad y el estado llevan texto, no solo color', () => {
    render(
      <>
        <InsigniaPrioridad prioridad={1} />
        <InsigniaPrioridad prioridad={2} />
        <InsigniaPrioridad prioridad={3} />
        <InsigniaEstadoTarea estado="Pendiente" />
        <InsigniaEstadoTarea estado="Completada" />
      </>,
    );
    for (const texto of ['Baja', 'Media', 'Alta', 'Pendiente', 'Completada']) {
      expect(screen.getByText(texto)).toBeTruthy();
    }
  });
});

describe('TablaTareas', () => {
  it('muestra todas las columnas del plan y las fechas formateadas', () => {
    render(<TablaTareas tareas={[TAREA]} />);
    for (const columna of ['Título', 'Categoría', 'Prioridad', 'Estado', 'Fecha límite', 'Creada', 'Acciones']) {
      expect(screen.getByRole('columnheader', { name: columna })).toBeTruthy();
    }
    expect(screen.getAllByText('Renovar pasaporte').length).toBe(2); // tabla y tarjeta apilada
    expect(screen.getAllByText('10/03/2026').length).toBeGreaterThan(0); // fecha límite, formato es-CO
    expect(screen.getAllByText('1/03/2026').length).toBeGreaterThan(0); // fecha de creación
  });

  it('incluye las tarjetas para pantallas angostas', () => {
    const { container } = render(<TablaTareas tareas={[TAREA]} />);
    expect(container.querySelector('ul.sm\\:hidden li')).toBeTruthy();
    expect(container.querySelector('div.sm\\:block table')).toBeTruthy();
  });
});

describe('componentes base', () => {
  it('Aviso dice su tipo con texto y usa alert solo para error y advertencia', () => {
    render(
      <>
        <Aviso tipo="error">falló</Aviso>
        <Aviso tipo="info">dato</Aviso>
      </>,
    );
    expect(screen.getByText('Error:')).toBeTruthy();
    expect(screen.getByText('Información:')).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('Boton con cargando queda deshabilitado y lo anuncia', () => {
    render(<Boton cargando>Guardar</Boton>);
    const b = screen.getByRole('button', { name: 'Guardar' });
    expect(b.hasAttribute('disabled')).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
  });

  it('Campo asocia etiqueta, ayuda y error con el control', () => {
    render(<Campo id="x" etiqueta="Nombre" ayuda="Su nombre" error="Obligatorio" />);
    const campo = screen.getByLabelText('Nombre');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe('x-ayuda x-error');
  });
});
