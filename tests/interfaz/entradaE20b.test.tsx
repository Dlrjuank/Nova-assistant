// E20b (commit 10): la entrada con la Estrella nova en un cielo de noche. Las animaciones se prueban en Edge; aquí,
// los estados, el teclado, los lectores de pantalla, el encendido solo a los 2 s y "reducir movimiento".
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));

import { estrellasDelCielo } from '@/components/login/CieloNoche';
import { ENCENDER_SOLA_MS } from '@/components/login/EntradaNova';
import { LoginForm } from '@/components/login/LoginForm';

const estado = () => document.querySelector('[data-entrada-estado]')?.getAttribute('data-entrada-estado');
let reducir = false;

beforeEach(() => {
  reducir = false;
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') ? reducir : false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Entrada con la Estrella nova', () => {
  it('empieza apagada, con la indicación, y el formulario ya se puede usar con el teclado y los lectores de pantalla', () => {
    render(<LoginForm />);
    expect(estado()).toBe('apagada');
    expect(screen.getByRole('button', { name: 'Encender la estrella de Nova' })).toBeTruthy();
    expect(screen.getByText('Toca la estrella')).toBeTruthy();
    expect(screen.getByText('Haz clic en la estrella')).toBeTruthy();
    expect(screen.getByText('o pulsa Enter')).toBeTruthy();
    // El formulario está en la página (no oculto para lectores de pantalla ni fuera del orden de Tab).
    const correo = screen.getByLabelText('Correo electrónico');
    expect(correo.closest('[aria-hidden="true"]')).toBeNull();
    expect(correo.closest('[inert]')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeTruthy();
  });

  it('al tocar la estrella (o Enter, que en un botón es un clic) se enciende: brillo, tres ondas y sin la indicación', () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Encender la estrella de Nova' }));
    expect(estado()).toBe('encendiendo');
    expect(document.querySelectorAll('[data-onda]')).toHaveLength(3);
    // Las ondas van dentro de la estrella que viaja, no se quedan en el centro.
    expect(document.querySelector('[data-estrella-viajera] [data-onda]')).toBeTruthy();
    expect(document.querySelector('[data-indicacion]')).toBeNull();
  });

  it('si nadie la toca, se enciende sola a los 2 s', () => {
    render(<LoginForm />);
    act(() => {
      vi.advanceTimersByTime(ENCENDER_SOLA_MS - 10);
    });
    expect(estado()).toBe('apagada');
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(estado()).toBe('encendiendo');
  });

  it('al llegar con Tab al formulario, la estrella se enciende', () => {
    render(<LoginForm />);
    fireEvent.focus(screen.getByLabelText('Correo electrónico'));
    expect(estado()).toBe('encendiendo');
  });

  it('con "reducir movimiento", todo está encendido desde el principio y la estrella queda en su lugar', () => {
    reducir = true;
    render(<LoginForm />);
    expect(estado()).toBe('encendida');
    expect(screen.queryByRole('button', { name: 'Encender la estrella de Nova' })).toBeNull();
    expect(document.querySelector('[data-hueco-estrella="movil"] svg')).toBeTruthy();
    expect(document.querySelector('[data-formulario-entrada]')?.className).toContain('opacity-100');
  });

  it('las estrellas del fondo son siempre las mismas (servidor y navegador) y pocas', () => {
    const a = estrellasDelCielo();
    expect(a).toEqual(estrellasDelCielo());
    expect(a.length).toBeLessThanOrEqual(80);
    expect(a.every((e) => e.x >= 0 && e.x <= 100 && e.duracion >= 2 && e.duracion <= 6)).toBe(true);
  });

  it('el cielo es de noche en los dos temas y su texto se lee (contraste ≥ 4,5:1)', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const valor = (n: string) => (new RegExp(`--nova-${n}:\\s*(#[0-9a-f]{6})`, 'i').exec(css) as RegExpExecArray)[1] as string;
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contraste = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    for (const fondo of ['cielo-arriba', 'cielo-abajo']) {
      expect(contraste(valor('cielo-texto'), valor(fondo))).toBeGreaterThanOrEqual(4.5);
      expect(contraste(valor('cielo-texto-suave'), valor(fondo))).toBeGreaterThanOrEqual(4.5);
    }
    // Una sola definición: no cambia con el tema oscuro.
    expect(css.match(/--nova-cielo-arriba:/g)).toHaveLength(1);
  });
});
