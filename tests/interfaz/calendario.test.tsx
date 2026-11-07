// E07: vista mensual del Calendario.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => '/nova/calendario' }));

import { CalendarioMes, type TareaCalendario } from '@/components/nova/calendario/CalendarioMes';
import { semanasDelMes } from '@/lib/reglas/calendario';

const t = (id: string, fechaLimite: string, extra: Partial<TareaCalendario> = {}): TareaCalendario => ({
  id, titulo: `Tarea ${id}`, categoria: 'Casa', prioridad: 2, estado: 'Pendiente', fechaLimite, horaInicio: null, horaFin: null, ...extra,
});
const CATEGORIAS = [{ nombre: 'Casa', color: 'verde' }, { nombre: 'General', color: 'gris' }];
const props = (porDia: Record<string, TareaCalendario[]>, hoy = '2026-11-07') => ({
  mes: '2026-11',
  titulo: 'noviembre de 2026',
  hoy,
  semanas: semanasDelMes('2026-11'),
  porDia,
  categorias: CATEGORIAS,
  anterior: '/nova/calendario?mes=2026-10',
  siguiente: '/nova/calendario?mes=2026-12',
});
const diaLabel = (texto: RegExp) => screen.getByRole('button', { name: texto });

afterEach(cleanup);

describe('CalendarioMes', () => {
  it('título del mes, días de la semana, flechas y "Hoy"', () => {
    render(<CalendarioMes {...props({})} />);
    expect(screen.getByRole('heading', { name: 'noviembre de 2026' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']);
    expect(screen.getByRole('link', { name: 'Mes anterior' }).getAttribute('href')).toBe('/nova/calendario?mes=2026-10');
    expect(screen.getByRole('link', { name: 'Mes siguiente' }).getAttribute('href')).toBe('/nova/calendario?mes=2026-12');
    expect(screen.getByRole('button', { name: 'Hoy' })).toBeTruthy(); // en el mes actual elige hoy sin recargar
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
  });

  it('empieza en hoy; elegir otro día muestra su lista y "Agregar" con esa fecha', () => {
    render(<CalendarioMes {...props({ '2026-11-10': [t('1', '2026-11-10')] })} />);
    expect(screen.getByRole('heading', { level: 2, name: /sábado 7 de nov\..*Hoy/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Agregar' }).getAttribute('href')).toBe('/nova/tareas/nueva?fecha=2026-11-07');
    fireEvent.click(diaLabel(/^martes 10 de nov\., 1 tarea/));
    expect(screen.getByRole('heading', { level: 2, name: 'martes 10 de nov.' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Completar «Tarea 1»' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Agregar' }).getAttribute('href')).toBe('/nova/tareas/nueva?fecha=2026-11-10');
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.getByRole('link', { name: 'Agregar' }).getAttribute('href')).toBe('/nova/tareas/nueva?fecha=2026-11-07');
  });

  it('puntos de color (máximo 3 y "+N") y títulos cortos con hora (máximo 2 y "+N más")', () => {
    const cinco = [t('a', '2026-11-12', { horaInicio: '08:00' }), t('b', '2026-11-12'), t('c', '2026-11-12'), t('d', '2026-11-12'), t('e', '2026-11-12')];
    render(<CalendarioMes {...props({ '2026-11-12': cinco })} />);
    const celda = diaLabel(/^jueves 12 de nov\., 5 tareas/);
    expect(celda.querySelectorAll('.bg-cat-verde')).toHaveLength(3 + 2); // 3 puntos + 2 títulos
    expect(within(celda).getByText('+2')).toBeTruthy();
    expect(within(celda).getByText('8:00 Tarea a')).toBeTruthy();
    expect(within(celda).getByText('+3 más')).toBeTruthy();
  });

  it('las pendientes vencidas llevan la marca "Vencida"; las completadas no', () => {
    render(
      <CalendarioMes
        {...props({ '2026-11-03': [t('v', '2026-11-03'), t('h', '2026-11-03', { estado: 'Completada' })] })}
      />,
    );
    fireEvent.click(diaLabel(/^martes 3 de nov\., 2 tareas \(1 pendiente\)/));
    const lista = screen.getByRole('heading', { level: 2, name: 'martes 3 de nov.' }).closest('section') as HTMLElement;
    expect(within(lista).getAllByText('Vencida')).toHaveLength(1);
    expect(within(lista).getByRole('checkbox', { name: 'Completar «Tarea v»' }).closest('li')?.textContent).toContain('Vencida');
  });

  it('al elegir un día, lleva su lista arriba de la pantalla ya dibujada; si se ve entera no la mueve', () => {
    const pedidos: Array<{ block: string | undefined; behavior: string | undefined; tareas: number }> = [];
    let rect = { top: 900, bottom: 1400 }; // la lista empieza debajo del borde inferior
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    const scrollOriginal = proto.scrollIntoView;
    const rectOriginal = proto.getBoundingClientRect;
    proto.scrollIntoView = function (this: HTMLElement, o: ScrollIntoViewOptions) {
      pedidos.push({ block: o.block, behavior: o.behavior, tareas: this.querySelectorAll('li').length });
    };
    proto.getBoundingClientRect = function (this: HTMLElement) {
      return this.getAttribute('aria-labelledby') === 'titulo-dia' ? rect : { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    };
    const matchOriginal = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes('min-width') || q.includes('reduce') })) as unknown as typeof window.matchMedia;
    try {
      render(<CalendarioMes {...props({ '2026-11-10': [t('1', '2026-11-10'), t('2', '2026-11-10'), t('3', '2026-11-10')] })} />);
      expect(pedidos).toHaveLength(0); // al abrir la página no se mueve
      fireEvent.click(diaLabel(/^martes 10 de nov\./));
      // Se mide con la lista nueva (3 tareas), arriba de la pantalla y sin animación con "reducir movimiento".
      expect(pedidos).toEqual([{ block: 'start', behavior: 'auto', tareas: 3 }]);
      rect = { top: 100, bottom: 600 };
      fireEvent.click(diaLabel(/^jueves 12 de nov\./));
      expect(pedidos).toHaveLength(1); // ya se veía entera
    } finally {
      proto.scrollIntoView = scrollOriginal;
      proto.getBoundingClientRect = rectOriginal;
      window.matchMedia = matchOriginal;
    }
  });

  it('día sin tareas y leyenda con las categorías del mes', () => {
    render(<CalendarioMes {...props({ '2026-11-12': [t('a', '2026-11-12')] })} />);
    expect(screen.getByText('Sin tareas este día.')).toBeTruthy();
    const leyenda = screen.getByRole('list', { name: 'Categorías de este mes' });
    expect(within(leyenda).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Casa']);
  });
});
