// E20b (commit 7): Semestre con fallas en puntos, barra de cortes, "¿Cuánto necesito?" con color, temas propuestos
// con borde punteado y "Proponer temas" con su estado "listo". Solo presentación: las reglas no cambian.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => m }));

import { Calculadora, NECESITO_DIFICIL, tonoNecesito } from '@/components/nova/semestre/Calculadora';
import { Fallas, MAX_PUNTOS_FALLAS } from '@/components/nova/semestre/Fallas';
import { TemasCorte } from '@/components/nova/semestre/TemasCorte';
import type { Materia, Tema } from '@/lib/dataService';

const CON_CORTES: Materia = {
  id: 'm1',
  nombre: 'Cálculo',
  creditos: 3,
  docente: null,
  usaCortes: true,
  fallasLimite: null,
  fallasRegistradas: 0,
  cortes: [
    { id: 'c1', orden: 1, nombre: 'Corte 1', porcentaje: 3000, fecha: null, componentes: [{ id: 'k1', orden: 1, nombre: 'Parcial', porcentaje: 10000, notas: [{ id: 'n1', orden: 1, nombre: null, nota: 400, fecha: null }] }] },
    { id: 'c2', orden: 2, nombre: 'Corte 2', porcentaje: 3000, fecha: null, componentes: [{ id: 'k2', orden: 1, nombre: 'Parcial', porcentaje: 10000, notas: [] }] },
    { id: 'c3', orden: 3, nombre: 'Corte 3', porcentaje: 4000, fecha: null, componentes: [{ id: 'k3', orden: 1, nombre: 'Final', porcentaje: 10000, notas: [] }] },
  ],
};
const puntos = () => [...document.querySelectorAll('[data-falla]')].map((p) => p.getAttribute('data-falla'));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Fallas en puntos', () => {
  it('un punto por falla permitida; las registradas en rojo; ocultos para lectores de pantalla', () => {
    render(<Fallas materiaId="m1" limite={5} registradas={2} />);
    expect(puntos()).toEqual(['si', 'si', 'no', 'no', 'no']);
    expect(document.querySelector('[data-puntos-fallas]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('al sumar en esta visita, el punto nuevo se pinta con un pulso; al llegar al límite la tarjeta va en rojo', () => {
    const { rerender, container } = render(<Fallas materiaId="m1" limite={3} registradas={1} />);
    expect(document.querySelector('.nova-falla-nueva')).toBeNull();
    rerender(<Fallas materiaId="m1" limite={3} registradas={2} />);
    expect([...document.querySelectorAll('[data-falla]')].findIndex((p) => p.classList.contains('nova-falla-nueva'))).toBe(1);
    rerender(<Fallas materiaId="m1" limite={3} registradas={3} />);
    expect((container.firstElementChild as HTMLElement).className).toContain('border-peligro!');
    // Sin `key`, los campos siguen a los datos nuevos del servidor.
    expect((screen.getByLabelText('Fallas registradas') as HTMLInputElement).value).toBe('3');
  });

  it('sin límite, o con un límite muy grande, no hay puntos (solo el número)', () => {
    render(<Fallas materiaId="m1" limite={null} registradas={4} />);
    expect(puntos()).toEqual([]);
    cleanup();
    render(<Fallas materiaId="m1" limite={MAX_PUNTOS_FALLAS + 1} registradas={4} />);
    expect(puntos()).toEqual([]);
  });
});

describe('Calculadora', () => {
  it('tono de "¿Cuánto necesito?": verde, ámbar desde más de 4,2, rojo si no se alcanza', () => {
    expect(tonoNecesito({ tipo: 'asegurado' }, 400)).toBe('exito');
    expect(tonoNecesito({ tipo: 'necesitas', decimas: NECESITO_DIFICIL }, 400)).toBe('exito');
    expect(tonoNecesito({ tipo: 'necesitas', decimas: NECESITO_DIFICIL + 1 }, 400)).toBe('aviso');
    expect(tonoNecesito({ tipo: 'imposible', maximo: 38 }, 450)).toBe('peligro');
    expect(tonoNecesito({ tipo: 'definitiva', nota: 40 }, 400)).toBe('exito');
    expect(tonoNecesito({ tipo: 'definitiva', nota: 39 }, 400)).toBe('peligro');
  });

  it('la barra de cortes: ancho por porcentaje, lleno hasta la nota y lo que falta rayado; la respuesta cambia de color con la meta', () => {
    render(<Calculadora materia={CON_CORTES} notaAprobar={300} redondeo="redondear" />);
    const barra = document.querySelector('[data-barra-cortes]') as HTMLElement;
    expect(barra.getAttribute('aria-hidden')).toBe('true');
    const tramos = [...barra.children] as HTMLElement[];
    expect(tramos.map((t) => t.style.flexGrow)).toEqual(['3000', '3000', '4000']);
    expect((tramos[0]?.firstElementChild as HTMLElement).style.width).toBe('80%'); // 4,0 de 5
    expect(tramos.slice(1).every((t) => t.className.includes('nova-rayado'))).toBe(true);

    // Con 4,0 en el 30 %, para 3,0 se necesita 2,6: verde. Para 4,5, 4,8: ámbar. Para 5,0 no se alcanza: rojo.
    expect(screen.getByRole('status').getAttribute('data-tono')).toBe('exito');
    fireEvent.change(screen.getByLabelText('Nota meta'), { target: { value: '4,5' } });
    expect(screen.getByRole('status').getAttribute('data-tono')).toBe('aviso');
    fireEvent.change(screen.getByLabelText('Nota meta'), { target: { value: '5' } });
    expect(screen.getByRole('status').getAttribute('data-tono')).toBe('peligro');
  });

  it('la nota actual cuenta, con su valor completo para lectores de pantalla', () => {
    render(<Calculadora materia={CON_CORTES} notaAprobar={300} redondeo="redondear" />);
    expect(screen.getAllByText('4,0').some((e) => e.classList.contains('sr-only'))).toBe(true);
  });
});

describe('Temas', () => {
  const TEMAS: Tema[] = [
    { id: 't1', corteId: 'c1', nombre: 'Límites', origen: 'manual', estado: 'confirmado', fuente: null },
    { id: 't2', corteId: 'c1', nombre: 'Derivadas', origen: 'asistente', estado: 'propuesto', fuente: 'syllabus.pdf · p. 2' },
  ];

  it('el propuesto lleva borde punteado; el confirmado no', () => {
    render(<TemasCorte corteId="c1" titulo="Corte 1" temas={TEMAS} documentos={[]} />);
    expect(document.querySelector('[data-tema="propuesto"]')?.className).toContain('border-dashed');
    expect(document.querySelector('[data-tema="confirmado"]')?.className).not.toContain('border-dashed');
  });

  it('"Proponer temas" termina en "Temas propuestos" y vuelve', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, datos: [TEMAS[1]] }))));
    render(<TemasCorte corteId="c1" titulo="Corte 1" temas={[]} documentos={[{ id: 'd1', nombre: 'syllabus.pdf' }]} />);
    fireEvent.click(screen.getByRole('button', { name: /Proponer temas/ }));
    const listo = await screen.findByRole('button', { name: /Temas propuestos/ });
    expect(listo.hasAttribute('disabled')).toBe(true);
    // Vuelve solo a los 2,5 s.
    expect(await screen.findByRole('button', { name: /Proponer temas/ }, { timeout: 4000 })).toBeTruthy();
  });
});
