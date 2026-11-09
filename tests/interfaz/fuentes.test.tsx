// E10: Fuentes con las pestañas "Subir PDF" y "Buscar en la web", y redirecciones de las rutas anteriores.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ exigirSesion: vi.fn(), listarDocumentos: vi.fn(), listarFuentesWeb: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => '/nova/fuentes' }));
vi.mock('@vercel/blob/client', () => ({ upload: vi.fn() }));
vi.mock('@/lib/dataService', () => ({ exigirSesion: m.exigirSesion, listarDocumentos: m.listarDocumentos, listarFuentesWeb: m.listarFuentesWeb }));

import FuentesPage from '@/app/nova/fuentes/page';
import nextConfig from '../../next.config';

const U = '11111111-1111-4111-8111-111111111111';
const abrir = async (pestana?: string) => {
  const arbol = await FuentesPage({ searchParams: Promise.resolve(pestana === undefined ? {} : { pestana }) });
  // La pestaña de PDF es un componente de servidor asíncrono: se resuelve antes de pintar.
  const hijos = arbol.props.children as Array<{ type: unknown; props: unknown } | false>;
  const resueltos = await Promise.all(
    hijos.map(async (h) => {
      if (h && typeof h === 'object' && typeof h.type === 'function' && ['PestanaPdf', 'PestanaWeb'].includes(h.type.name)) return (h.type as (p: unknown) => Promise<unknown>)(h.props);
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
  m.listarFuentesWeb.mockResolvedValue([]);
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

  it('E10b: capítulos, páginas, documento anterior y avance de un libro a medias', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // la indexación pendiente queda en curso
    const base = { categoria: 'General', fechaGuardado: '2026-11-09', numCapitulos: 0 };
    m.listarDocumentos.mockResolvedValue([
      { ...base, id: 'a', nombreArchivo: 'libro.pdf', numFragmentos: 9, paginas: 312, progreso: null, numCapitulos: 4 },
      { ...base, id: 'b', nombreArchivo: 'viejo.pdf', numFragmentos: 3, paginas: null, progreso: null },
      { ...base, id: 'c', nombreArchivo: 'largo.pdf', numFragmentos: 0, paginas: 500, progreso: 40 },
    ]);
    await abrir('pdf');
    const ver = screen.getAllByRole('link', { name: 'Ver capítulos de libro.pdf' });
    expect(ver[0]?.getAttribute('href')).toBe('/nova/fuentes/a/capitulos');
    expect(screen.getAllByText('312').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Ver capítulos de largo.pdf' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ver capítulos de viejo.pdf' })).toBeNull();
    expect(screen.getAllByText('Vuelve a indexar este documento para ver páginas y capítulos.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Indexando… 40 %').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Indexando «largo.pdf»… 40 %')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/nova/documentos/c/continuar', { method: 'POST' });
    vi.unstubAllGlobals();
  });

  it('E10b2: fuentes guardadas por categoría, con cupo, enlace y eliminar', async () => {
    m.listarFuentesWeb.mockResolvedValue([
      { id: 'f1', categoria: 'Viajes', url: 'https://es.wikipedia.org/wiki/Sierra_Nevada', extracto: 'Una cordillera.', fechaGuardado: '2026-11-09' },
      { id: 'f2', categoria: 'General', url: 'https://es.wikipedia.org/wiki/Fotos%C3%ADntesis', extracto: 'Un proceso.', fechaGuardado: '2026-11-09' },
    ]);
    await abrir('web');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['General1/20, 1 de 20 fuentes', 'Viajes1/20, 1 de 20 fuentes']);
    const enlace = screen.getByRole('link', { name: 'Fotosíntesis' });
    expect(enlace.getAttribute('href')).toBe('https://es.wikipedia.org/wiki/Fotos%C3%ADntesis');
    expect(enlace.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('button', { name: 'Eliminar fuente: Sierra Nevada' })).toBeTruthy();
    expect(m.listarFuentesWeb).toHaveBeenCalledWith(U);
  });

  it('E10b2: sin fuentes guardadas lo dice', async () => {
    await abrir('web');
    expect(screen.getByRole('heading', { name: 'Fuentes guardadas' })).toBeTruthy();
    expect(screen.getByText(/Aún no has guardado fuentes/)).toBeTruthy();
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
