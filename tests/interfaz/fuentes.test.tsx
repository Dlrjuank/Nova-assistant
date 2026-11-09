// E10: Fuentes con las pestañas "Subir PDF" y "Buscar en la web", y redirecciones de las rutas anteriores.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ exigirSesion: vi.fn(), listarDocumentos: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => '/nova/fuentes' }));
vi.mock('@vercel/blob/client', () => ({ upload: vi.fn() }));
vi.mock('@/lib/dataService', () => ({ exigirSesion: m.exigirSesion, listarDocumentos: m.listarDocumentos }));

import FuentesPage from '@/app/nova/fuentes/page';
import nextConfig from '../../next.config';

const U = '11111111-1111-4111-8111-111111111111';
const abrir = async (pestana?: string) => {
  const arbol = await FuentesPage({ searchParams: Promise.resolve(pestana === undefined ? {} : { pestana }) });
  // La pestaña de PDF es un componente de servidor asíncrono: se resuelve antes de pintar.
  const hijos = arbol.props.children as Array<{ type: unknown; props: unknown } | false>;
  const resueltos = await Promise.all(
    hijos.map(async (h) => {
      if (h && typeof h === 'object' && typeof h.type === 'function' && h.type.name === 'PestanaPdf') return (h.type as (p: unknown) => Promise<unknown>)(h.props);
      return h;
    }),
  );
  return render(<>{resueltos as never}</>);
};
const pestanas = () => within(screen.getByRole('navigation', { name: 'Tipo de fuente' })).getAllByRole('link');

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U, email: 'dueno@ejemplo.com' });
  m.listarDocumentos.mockResolvedValue([]);
});
afterEach(cleanup);

describe('Fuentes', () => {
  it('por defecto abre "Subir PDF" con el formulario y los documentos del usuario', async () => {
    await abrir();
    const [pdf, web] = pestanas();
    expect(pdf?.getAttribute('aria-current')).toBe('page');
    expect(pdf?.getAttribute('href')).toBe('/nova/fuentes?pestana=pdf');
    expect(web?.getAttribute('aria-current')).toBeNull();
    expect(web?.getAttribute('href')).toBe('/nova/fuentes?pestana=web');
    expect(screen.getByLabelText('Archivo PDF')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tus documentos' })).toBeTruthy();
    expect(screen.getByText('Aún no hay documentos')).toBeTruthy();
    expect(screen.getByText(/de hasta 15 MB/)).toBeTruthy();
    expect(m.listarDocumentos).toHaveBeenCalledWith(U);
  });

  it('muestra los documentos con su acción de eliminar', async () => {
    m.listarDocumentos.mockResolvedValue([{ id: 'd', nombreArchivo: 'guia.pdf', categoria: 'General', numFragmentos: 4, fechaGuardado: '2026-11-09' }]);
    await abrir('pdf');
    expect(screen.getAllByText('guia.pdf').length).toBeGreaterThan(0);
    expect(screen.queryByText('Aún no hay documentos')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Eliminar/ }).length).toBeGreaterThan(0);
  });

  it('"Buscar en la web" muestra el buscador y el aviso, sin leer documentos', async () => {
    await abrir('web');
    const [pdf, web] = pestanas();
    expect(web?.getAttribute('aria-current')).toBe('page');
    expect(pdf?.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText(/al proveedor del asistente/)).toBeTruthy();
    expect(screen.queryByLabelText('Archivo PDF')).toBeNull();
    expect(m.listarDocumentos).not.toHaveBeenCalled();
  });

  it('un valor desconocido abre "Subir PDF"', async () => {
    await abrir('otra');
    expect(pestanas()[0]?.getAttribute('aria-current')).toBe('page');
  });
});

describe('rutas anteriores', () => {
  it('redirigen de forma permanente a la pestaña correcta', async () => {
    const reglas = await nextConfig.redirects?.();
    expect(reglas).toEqual([
      { source: '/nova/documentos', destination: '/nova/fuentes?pestana=pdf', permanent: true },
      { source: '/nova/documentos/nuevo', destination: '/nova/fuentes?pestana=pdf', permanent: true },
      { source: '/nova/web', destination: '/nova/fuentes?pestana=web', permanent: true },
    ]);
  });
});
