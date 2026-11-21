// E20b (commit 1): navegación nueva: perfil, globo de vencidas, tarjeta de aviso, submenú de Semestre, barra
// lateral plegable y el menú "Más" con su posición. Lo de E03 (secciones, foco, cerrar) sigue en navegacion.test.tsx.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ ruta: '/nova/tareas' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => nav.ruta,
}));

import { NavegacionNova } from '@/components/nova/NavegacionNova';
import { BarraInferior } from '@/components/nova/navegacion/BarraInferior';
import { BarraLateral } from '@/components/nova/navegacion/BarraLateral';
import { CLAVE_LATERAL } from '@/lib/tema';

const AVISOS = { nombre: 'Juan', vencidas: 2, proximoCorte: null };
const conAvisos = (datos: unknown = AVISOS) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, datos }), { status: 200 })));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  nav.ruta = '/nova/tareas';
  document.documentElement.removeAttribute('data-lateral');
  localStorage.clear();
});

describe('navegación con avisos', () => {
  it('pide los avisos una vez y muestra el perfil, el globo de vencidas en las dos barras y la tarjeta de aviso', async () => {
    conAvisos();
    render(<NavegacionNova email="juan@ejemplo.com" />);
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Tareas 2 tareas vencidas' })).toHaveLength(2));
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api/nova/avisos');
    expect(screen.getByText('Juan')).toBeTruthy();
    const aviso = document.querySelector('a[href="/nova/tareas?vista=vencidas"]') as HTMLElement;
    expect(aviso.textContent).toBe('Aviso2 tareas vencidasRevísalas en Tareas.');
    // El enlace de Tareas dice cuántas vencidas hay (el globo), también para lectores de pantalla.
    expect(screen.getAllByRole('link', { name: 'Tareas 2 tareas vencidas' })).toHaveLength(2);
  });

  it('si el pedido falla, la navegación sigue igual, sin globo ni aviso; el perfil usa el correo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('sin red')));
    render(<NavegacionNova email="estudiante@ejemplo.com" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByLabelText(/tareas? vencidas?/)).toBeNull();
    expect(screen.getByText('estudiante')).toBeTruthy();
  });
});

describe('BarraLateral', () => {
  it('en Semestre muestra sus tres pestañas como submenú, con la actual marcada; el botón lo oculta', () => {
    nav.ruta = '/nova/semestre/objetivos';
    render(<BarraLateral email="yo@ejemplo.com" />);
    const sub = document.getElementById('submenu-semestre') as HTMLElement;
    expect(within(sub).getAllByRole('link').map((a) => a.textContent)).toEqual(['Materias y notas', 'Objetivos y plan', 'Estadísticas']);
    expect(within(sub).getByRole('link', { name: 'Objetivos y plan' }).getAttribute('aria-current')).toBe('page');
    const boton = screen.getByRole('button', { name: 'Ocultar las secciones de Semestre' });
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(boton);
    expect(document.getElementById('submenu-semestre')).toBeNull();
    // Sin submenú, la sección Semestre es la marcada.
    expect(screen.getByRole('link', { name: 'Semestre' }).getAttribute('aria-current')).toBe('page');
  });

  it('una materia (/nova/semestre/{id}) va con "Materias y notas"', () => {
    nav.ruta = '/nova/semestre/22222222-2222-4222-8222-222222222222';
    render(<BarraLateral email="yo@ejemplo.com" />);
    expect(screen.getByRole('link', { name: 'Materias y notas' }).getAttribute('aria-current')).toBe('page');
  });

  it('se pliega a solo íconos y se recuerda en el navegador; los nombres siguen para lectores de pantalla', () => {
    render(<BarraLateral email="yo@ejemplo.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Plegar el menú a solo íconos' }));
    expect(document.documentElement.getAttribute('data-lateral')).toBe('plegada');
    expect(localStorage.getItem(CLAVE_LATERAL)).toBe('plegada');
    expect(screen.getByRole('link', { name: 'Tareas' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Desplegar el menú' }));
    expect(document.documentElement.hasAttribute('data-lateral')).toBe(false);
    expect(localStorage.getItem(CLAVE_LATERAL)).toBe('desplegada');
  });

  it('los botones que solo cambian cómo se ve el menú siguen activos sin conexión', () => {
    nav.ruta = '/nova/semestre';
    render(<BarraLateral email="yo@ejemplo.com" />);
    for (const nombre of ['Plegar el menú a solo íconos', 'Ocultar las secciones de Semestre']) {
      expect(screen.getByRole('button', { name: nombre }).getAttribute('data-sin-conexion')).toBe('permitido');
    }
  });
});

describe('menú "Más"', () => {
  it('dice en qué sección estás (02 / 04) y marca la actual', () => {
    nav.ruta = '/nova/productividad';
    render(<BarraInferior email="yo@ejemplo.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    const hoja = screen.getByRole('dialog', { name: 'Más secciones' });
    expect(within(hoja).getByText('02 / 04')).toBeTruthy();
    expect(within(hoja).getByRole('link', { name: 'Productividad' }).getAttribute('aria-current')).toBe('page');
  });
});
