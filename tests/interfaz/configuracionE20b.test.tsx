// E20b (commit 9): Configuración con títulos con ícono, la inicial del perfil, el tema en tarjetas, botones con
// "Guardado" y el índice de secciones en pantalla ancha. Solo presentación.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/nova/configuracion' }));

import { BloqueApariencia } from '@/components/nova/configuracion/BloqueApariencia';
import { BloquePerfil } from '@/components/nova/configuracion/BloquePerfil';
import { IndiceConfiguracion } from '@/components/nova/configuracion/IndiceConfiguracion';
import { SECCIONES_CONFIGURACION } from '@/components/nova/configuracion/TituloBloque';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const config = (nombre: string) => ({
  ok: true,
  datos: { perfil: { nombre, email: 'yo@ejemplo.com' }, preferencias: { tema: 'automatico', formatoHora: '24', notaAprobar: 300, redondeo: 'truncar', cortesDefecto: [3000, 3000, 4000] } },
});

describe('Configuración', () => {
  it('Perfil: título con ícono, la inicial del nombre y "Guardar nombre" que termina en "Guardado"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(config('Valentina')))));
    render(<BloquePerfil nombre="ana" email="yo@ejemplo.com" />);
    expect(screen.getByRole('heading', { name: 'Perfil' }).querySelector('svg')).toBeTruthy();
    expect(document.querySelector('[data-inicial-perfil]')?.textContent).toBe('A');
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Valentina' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    expect(await screen.findByRole('button', { name: /Guardado/ })).toBeTruthy();
    expect(document.querySelector('[data-inicial-perfil]')?.textContent).toBe('V');
    expect(screen.getByText('Se guardó tu nombre.')).toBeTruthy();
  });

  it('Apariencia: cada tema es una tarjeta con su ícono y el mismo nombre de siempre', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(config('Ana')))));
    render(<BloqueApariencia tema="claro" formatoHora="24" />);
    for (const v of ['claro', 'oscuro', 'automatico', '24', '12']) expect(document.querySelector(`[data-opcion="${v}"] svg`)).toBeTruthy();
    expect((screen.getByLabelText('Claro') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText('Claro').className).toContain('sr-only');
  });

  it('el índice de pantalla ancha enlaza a cada sección, marca la elegida y funciona sin conexión', () => {
    render(<IndiceConfiguracion />);
    const enlaces = screen.getAllByRole('link');
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(SECCIONES_CONFIGURACION.map((s) => `#${s.id}`));
    expect(enlaces.every((a) => a.getAttribute('data-sin-conexion') === 'permitido')).toBe(true);
    expect(enlaces[0]?.getAttribute('aria-current')).toBe('true');
    fireEvent.click(screen.getByRole('link', { name: 'Notificaciones' }));
    expect(screen.getByRole('link', { name: 'Notificaciones' }).getAttribute('aria-current')).toBe('true');
    // Solo desde 1280 px.
    expect(document.querySelector('[data-indice-configuracion]')?.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'xl:block']));
  });
});
