import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TarjetaProductividad } from '@/components/nova/TarjetaProductividad';

const responder = (cuerpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));
const RESULTADO = {
  fecha: '2026-03-10',
  totales: 5,
  completadas: 4,
  minutos: 120,
  puntos: 86,
  nivel: 'Excelente',
  recomendacion: 'Mantén el ritmo.',
  recomendacionDisponible: true,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TarjetaProductividad', () => {
  it('al abrir calcula el día de hoy y muestra puntos con un decimal, nivel con texto y recomendación', async () => {
    const f = vi.fn().mockImplementation(() => responder({ ok: true, datos: RESULTADO }));
    vi.stubGlobal('fetch', f);
    render(<TarjetaProductividad hoy="2026-03-10" />);
    expect(screen.getByText('Calculando…')).toBeTruthy();
    expect(await screen.findByText('86,0')).toBeTruthy();
    expect(screen.getByText('Nivel: Excelente')).toBeTruthy();
    expect(screen.getByText('4 de 5')).toBeTruthy();
    expect(screen.getByText('Mantén el ritmo.')).toBeTruthy();
    expect(f).toHaveBeenCalledTimes(1);
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ fecha: '2026-03-10' });
  });

  it('RN-18: un día sin tareas muestra el mensaje exacto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => responder({ ok: true, datos: { sinTareas: true } })));
    render(<TarjetaProductividad hoy="2026-03-10" />);
    expect(await screen.findByText(/Sin tareas programadas para esta fecha/)).toBeTruthy();
  });

  it('otra fecha con la máscara; una fecha irreal deshabilita Calcular y "Hoy" vuelve al día actual', async () => {
    const f = vi.fn().mockImplementation(() => responder({ ok: true, datos: { sinTareas: true } }));
    vi.stubGlobal('fetch', f);
    render(<TarjetaProductividad hoy="2026-03-10" />);
    await screen.findByText(/Sin tareas programadas/);
    const campo = screen.getByLabelText('Fecha') as HTMLInputElement;

    fireEvent.change(campo, { target: { value: '20260230' } });
    expect(campo.value).toBe('2026-02-30');
    expect(screen.getByRole('button', { name: 'Calcular' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('La fecha debe tener formato AAAA-MM-DD y ser una fecha real.')).toBeTruthy();

    fireEvent.change(campo, { target: { value: '20260309' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    expect(JSON.parse(f.mock.calls[1]?.[1].body)).toEqual({ fecha: '2026-03-09' });

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(3));
    expect(JSON.parse(f.mock.calls[2]?.[1].body)).toEqual({ fecha: '2026-03-10' });
    expect(campo.value).toBe('2026-03-10');
  });

  it('si la recomendación no está disponible, el índice se muestra igual', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        responder({
          ok: true,
          datos: {
            ...RESULTADO,
            puntos: 49.5,
            nivel: 'Bajo',
            recomendacion: 'No se pudo generar la recomendación en este momento.',
            recomendacionDisponible: false,
          },
        }),
      ),
    );
    render(<TarjetaProductividad hoy="2026-03-10" />);
    expect(await screen.findByText('49,5')).toBeTruthy();
    expect(screen.getByText('Nivel: Bajo')).toBeTruthy();
    expect(screen.getByText('No se pudo generar la recomendación en este momento.')).toBeTruthy();
  });

  it('un error del servidor o de red muestra un aviso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')));
    render(<TarjetaProductividad hoy="2026-03-10" />);
    expect(await screen.findByText('No se pudo conectar con el servidor. Intente de nuevo.')).toBeTruthy();
  });
});
