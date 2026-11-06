// E02: script del tema, encabezado de pantalla, pestañas e insignias con los tokens nuevos.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { Insignia } from '@/components/ui/Insignia';
import { Pestanas } from '@/components/ui/Pestanas';
import { CLAVE_TEMA, SCRIPT_TEMA, atributoTema, esTema } from '@/lib/tema';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-tema');
  vi.restoreAllMocks();
});

function correrScript() {
  new Function(SCRIPT_TEMA)();
}

describe('script del tema (sin parpadeo)', () => {
  it('aplica claro u oscuro guardados en el navegador', () => {
    for (const t of ['claro', 'oscuro'] as const) {
      localStorage.setItem(CLAVE_TEMA, t);
      correrScript();
      expect(document.documentElement.getAttribute('data-tema')).toBe(t);
    }
  });

  it('automático, nada guardado o un valor desconocido no fijan tema (sigue al sistema)', () => {
    for (const valor of ['automatico', null, 'rojo']) {
      if (valor === null) localStorage.removeItem(CLAVE_TEMA);
      else localStorage.setItem(CLAVE_TEMA, valor);
      correrScript();
      expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
    }
  });

  it('si el navegador bloquea localStorage no rompe la página', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(correrScript).not.toThrow();
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
  });

  it('esTema y atributoTema', () => {
    expect(['claro', 'oscuro', 'automatico'].every(esTema)).toBe(true);
    expect(esTema('azul')).toBe(false);
    expect(atributoTema('oscuro')).toBe('oscuro');
    expect(atributoTema('automatico')).toBeNull();
  });
});

describe('componentes base', () => {
  it('EncabezadoPantalla: título como h1, subtítulo y acción', () => {
    render(<EncabezadoPantalla titulo="Tareas" subtitulo="Tus pendientes" accion={<button type="button">Nueva</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tareas' })).toBeTruthy();
    expect(screen.getByText('Tus pendientes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nueva' })).toBeTruthy();
  });

  it('Pestanas: enlaces en una navegación con nombre; solo la activa lleva aria-current', () => {
    render(
      <Pestanas
        etiqueta="Filtrar"
        pestanas={[
          { href: '/a', texto: 'Todas', activa: true },
          { href: '/b', texto: 'Hoy', activa: false },
        ]}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Filtrar' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Todas' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Hoy' }).getAttribute('aria-current')).toBeNull();
  });

  it('Insignia usa solo tokens de color (sin colores sueltos)', () => {
    render(<Insignia tono="peligro">Alta</Insignia>);
    const clase = screen.getByText('Alta').className;
    expect(clase).toContain('text-peligro');
    expect(clase).not.toMatch(/#|black|white|rgb/);
  });
});
