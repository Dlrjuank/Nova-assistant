// E10b: el avance sube en pantalla, termina sin recargar y, si falla, se puede reintentar.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav }));

import { IndexacionPendiente } from '@/components/nova/IndexacionPendiente';

const DOC = { id: 'd1', nombreArchivo: 'libro.pdf', progreso: 10 };
const ok = (datos: unknown) => ({ ok: true, json: async () => ({ ok: true, datos }) });
const f = vi.fn();
const barra = () => screen.getByRole('progressbar') as HTMLProgressElement;

beforeEach(() => {
  f.mockReset();
  nav.refresh.mockReset();
  vi.stubGlobal('fetch', f);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('IndexacionPendiente', () => {
  it('el porcentaje sube con cada parte, sin salir de la pantalla', async () => {
    const resolvers: Array<(v: unknown) => void> = [];
    f.mockImplementation(() => new Promise((r) => resolvers.push(r)));
    render(<IndexacionPendiente pendientes={[DOC]} />);
    expect(screen.getByText(/Indexando «libro\.pdf»… 10 %/)).toBeTruthy();
    expect(screen.getByText('Deja esta pantalla abierta hasta que termine.')).toBeTruthy();

    await act(async () => resolvers[0]?.(ok({ progreso: 40 })));
    await waitFor(() => expect(barra().value).toBe(40));
    expect(screen.getByText(/libro\.pdf»… 40 %/)).toBeTruthy();
    expect(nav.refresh).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () => resolvers[1]?.(ok({ progreso: 80 })));
    await waitFor(() => expect(barra().value).toBe(80));
    expect(f).toHaveBeenCalledWith('/api/nova/documentos/d1/continuar', { method: 'POST' });
  });

  it('al terminar refresca la lista y avisa que quedó listo', async () => {
    f.mockResolvedValue(ok({ progreso: null }));
    const { rerender } = render(<IndexacionPendiente pendientes={[DOC]} />);
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(f).toHaveBeenCalledTimes(1);
    rerender(<IndexacionPendiente pendientes={[]} />);
    expect(screen.getByText(/«libro\.pdf» quedó indexado/)).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('si falla, muestra el mensaje y "Reintentar" sigue desde donde iba', async () => {
    f.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, error: { mensaje: 'Se alcanzó el límite.' } }) });
    render(<IndexacionPendiente pendientes={[DOC]} />);
    expect(await screen.findByText('Se alcanzó el límite.')).toBeTruthy();
    expect(f).toHaveBeenCalledTimes(1);
    f.mockResolvedValue(ok({ progreso: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Se alcanzó el límite.')).toBeNull());
  });

  it('una conexión cortada se retoma sola al volver a la pantalla', async () => {
    f.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<IndexacionPendiente pendientes={[DOC]} />);
    expect(await screen.findByText(/Se perdió la conexión/)).toBeTruthy();
    f.mockResolvedValue(ok({ progreso: null }));
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
  });

  it('sin pendientes no muestra nada', () => {
    const { container } = render(<IndexacionPendiente pendientes={[]} />);
    expect(container.textContent).toBe('');
    expect(f).not.toHaveBeenCalled();
  });
});
