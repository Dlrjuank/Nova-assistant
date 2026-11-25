// E20b (iPhone, pedido del usuario): con el teclado abierto el diálogo cabe en la parte visible y el campo no queda
// tapado; los campos que no son de personas no hacen que el iPhone ofrezca contactos.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Campo } from '@/components/ui/Campo';
import { Dialogo } from '@/components/ui/Dialogo';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Prueba() {
  const origen = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={origen}>Abrir</button>
      <Dialogo abierto titulo="Crear materia" alCerrar={() => {}} origen={origen}>
        <Campo id="materia-texto" etiqueta="Materia" />
      </Dialogo>
    </>
  );
}

describe('Diálogo con el teclado abierto', () => {
  it('ocupa solo la parte visible (sin el teclado) y la sigue cuando cambia', () => {
    const oyentes: Record<string, () => void> = {};
    const vv = { offsetTop: 0, height: 844, addEventListener: (t: string, f: () => void) => (oyentes[t] = f), removeEventListener: vi.fn() };
    vi.stubGlobal('visualViewport', vv);
    render(<Prueba />);
    const fondo = document.querySelector('[data-dialogo-fondo]') as HTMLElement;
    expect(fondo.style.height).toBe('844px');
    // El teclado ocupa la mitad de abajo y el iPhone desplaza la vista 120 px.
    act(() => {
      vv.height = 420;
      vv.offsetTop = 120;
      oyentes.resize?.();
    });
    expect(fondo.style.height).toBe('420px');
    expect(fondo.style.top).toBe('120px');
    // La hoja nunca es más alta que lo visible menos la franja de arriba.
    expect(screen.getByRole('dialog').className).toContain('max-h-[min(85dvh,calc(100%-env(safe-area-inset-top,0px)-0.75rem))]');
  });

  it('al enfocar un campo lo lleva a la vista dentro de la hoja', () => {
    const llevar = vi.fn();
    HTMLElement.prototype.scrollIntoView = llevar;
    render(<Prueba />);
    fireEvent.focus(screen.getByLabelText('Materia'));
    expect(llevar).toHaveBeenCalledWith({ block: 'nearest' });
  });
});

describe('Sin "Autorrellenar contacto" en campos que no son de personas', () => {
  it('Campo usa autoComplete="off" salvo que pida otro', () => {
    render(
      <>
        <Campo id="a" etiqueta="Materia" />
        <Campo id="b" etiqueta="Nombre" autoComplete="name" />
      </>,
    );
    expect(screen.getByLabelText('Materia').getAttribute('autocomplete')).toBe('off');
    expect(screen.getByLabelText('Nombre').getAttribute('autocomplete')).toBe('name');
  });

  it('ningún campo de Nova usa "nombre" en su id o etiqueta, salvo el nombre de la persona en Perfil', () => {
    const archivos: string[] = [];
    const recorrer = (d: string) => {
      for (const n of readdirSync(d)) {
        const r = join(d, n);
        if (statSync(r).isDirectory()) recorrer(r);
        else if (r.endsWith('.tsx')) archivos.push(r);
      }
    };
    recorrer('src/components/nova');
    const malos = archivos
      .filter((f) => !f.endsWith('BloquePerfil.tsx'))
      .flatMap((f) =>
        [...readFileSync(f, 'utf8').matchAll(/<Campo\b[^>]*?(?:id|etiqueta)=\{?["'`][^"'`]*(?:nombre|name)[^"'`]*["'`]/gi)].map((m) => `${f}: ${m[0].slice(0, 80)}`),
      );
    expect(malos).toEqual([]);
  });
});
