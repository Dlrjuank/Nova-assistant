// Corrección de E11b: señal de carga inmediata al cambiar de pestaña.
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import CargandoNova from '@/app/nova/loading';

afterEach(cleanup);

describe('CargandoNova (loading.tsx)', () => {
  it('anuncia "Cargando…" a los lectores de pantalla y marca el esqueleto', () => {
    const { container } = render(<CargandoNova />);
    expect(screen.getByRole('status').textContent).toBe('Cargando…');
    expect(container.querySelector('[data-nova-cargando]')?.getAttribute('aria-busy')).toBe('true');
  });

  it('solo se mueve sin "reducir movimiento" y solo usa los tokens de Nova', () => {
    const { container } = render(<CargandoNova />);
    const clases = [...container.querySelectorAll('[class]')].map((e) => e.getAttribute('class') ?? '').join(' ');
    expect(clases).toContain('motion-safe:animate-pulse');
    expect(clases).not.toMatch(/(^|\s)animate-pulse/);
    const fuente = readFileSync(join(process.cwd(), 'src/app/nova/loading.tsx'), 'utf8');
    expect(fuente).not.toMatch(/#[0-9a-f]{3,8}\b|\b(gray|slate|zinc|neutral|white|black)-\d*/i);
  });
});
