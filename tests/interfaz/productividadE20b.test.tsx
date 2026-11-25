// E20b (commit 8): Productividad y Cuestionarios con anillos que se llenan, barras, minigráfico, tendencia en
// píldora y "Crear cuestionario" con "listo". Solo presentación: los cálculos no cambian. Sin Gemini.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => m }));

import { Cuestionario } from '@/components/nova/cuestionarios/Cuestionario';
import { FormularioCuestionario } from '@/components/nova/cuestionarios/FormularioCuestionario';
import { evolucion, HistorialCuestionarios } from '@/components/nova/cuestionarios/HistorialCuestionarios';
import { TarjetaProductividad } from '@/components/nova/TarjetaProductividad';
import { Anillo, MiniGrafico } from '@/components/ui/Anillo';
import type { DocumentoHistorial } from '@/lib/dataService';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const intento = (o: Partial<DocumentoHistorial['cuestionarios'][number]['intentos'][number]>) => ({
  id: 'i',
  fecha: '2026-11-12',
  repaso: false,
  terminado: true,
  aciertos: 3,
  total: 5,
  puntaje: 300,
  comparacion: null,
  ...o,
});

describe('Anillo y minigráfico', () => {
  it('el anillo se llena hasta la fracción (entre 0 y 1) y es decorativo', () => {
    const { container } = render(<Anillo fraccion={1.4}>x</Anillo>);
    expect(container.querySelector('[data-anillo]')?.getAttribute('data-fraccion')).toBe('1.000');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('el minigráfico necesita al menos dos valores', () => {
    const { container, rerender } = render(<MiniGrafico valores={[300]} max={500} />);
    expect(container.querySelector('svg')).toBeNull();
    rerender(<MiniGrafico valores={[300, 400]} max={500} />);
    expect(container.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(2);
  });
});

describe('Productividad', () => {
  it('los puntos en un anillo del color del nivel, con barras de tareas y minutos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, datos: { fecha: '2026-11-25', totales: 4, completadas: 4, minutos: 60, recomendacionDisponible: true, puntos: 85, nivel: 'Excelente', recomendacion: 'Sigue así.' } }),
        ),
      ),
    );
    render(<TarjetaProductividad hoy="2026-11-25" />);
    expect(await screen.findByText('Sigue así.')).toBeTruthy();
    const anillo = document.querySelector('[data-anillo]') as HTMLElement;
    expect(anillo.getAttribute('data-fraccion')).toBe('0.850');
    expect(anillo.querySelector('circle.stroke-exito')).toBeTruthy();
    expect(screen.getByText(/puntos \(85,0\)/)).toBeTruthy(); // el dato completo para lectores de pantalla
    const barras = [...document.querySelectorAll('.nova-avance')] as HTMLElement[];
    expect(barras.map((b) => b.style.width)).toEqual(['100%', '50%']); // 4 de 4; 60 de 120 minutos
    expect(screen.getByText('Nivel: Excelente')).toBeTruthy();
  });
});

describe('Cuestionarios', () => {
  it('el resultado lleva la nota en un anillo; con todo bien, en verde', () => {
    render(
      <Cuestionario
        datos={{
          id: 'q1',
          tipo: 'unica',
          documento: { id: 'd1', nombre: 'libro.pdf', categoria: 'Biología' },
          alcance: 'Páginas 2–4',
          dificultad: 'media',
          pedidas: 1,
          intento: { id: 'i1', repaso: false, terminado: true, aciertos: 1, total: 1, puntaje: 500, preguntas: [], sugerencias: [] },
        }}
      />,
    );
    const resultado = document.querySelector('[data-resultado-cuestionario]') as HTMLElement;
    expect(resultado.querySelector('[data-anillo]')?.getAttribute('data-fraccion')).toBe('1.000');
    expect(resultado.querySelector('circle.stroke-exito')).toBeTruthy();
    expect(screen.getByText('5,0 de 5')).toBeTruthy();
  });

  it('historial: la evolución sin repasos, del más antiguo al más reciente, y la tendencia en píldora', () => {
    const intentos = [intento({ id: 'c', puntaje: 400, comparacion: 'mejor' }), intento({ id: 'b', repaso: true, puntaje: 500 }), intento({ id: 'a', puntaje: 300 })];
    expect(evolucion(intentos)).toEqual([300, 400]);
    render(
      <HistorialCuestionarios
        documentos={[{ id: 'd1', nombre: 'biologia.pdf', cuestionarios: [{ id: 'q1', alcance: 'La célula', tipo: 'unica', dificultad: 'media', preguntas: 5, creadoEn: '2026-11-10', intentos }] }]}
      />,
    );
    const grafico = document.querySelector('[data-minigrafico="q1"]') as SVGElement;
    expect(grafico.getAttribute('aria-hidden')).toBe('true');
    expect(grafico.querySelector('polyline')?.getAttribute('class')).toContain('stroke-exito');
    const pildora = document.querySelector('[data-comparacion="mejor"]') as HTMLElement;
    expect(pildora.textContent).toBe('Mejoraste');
    expect(pildora.className).toContain('bg-exito/10');
  });

  it('"Crear cuestionario" termina en "Cuestionario listo" mientras se abre', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, datos: { id: 'q9', creadas: 5, pedidas: 5 } }), { status: 201 })));
    render(<FormularioCuestionario documento={{ id: 'd1', paginas: 40 }} capitulos={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuestionario' }));
    expect(await screen.findByRole('button', { name: /Cuestionario listo/ })).toBeTruthy();
    expect(m.push).toHaveBeenCalledWith('/nova/cuestionarios/q9');
    expect(screen.queryByText(/Creando el cuestionario/)).toBeNull();
  });
});
