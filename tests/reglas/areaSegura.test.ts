// E11b (corrección para la app instalada en el iPhone): área segura inferior, fondo de la página y color de la
// barra de estado según el tema.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { aplicarColorBarra, aplicarTema, COLOR_FONDO, SCRIPT_TEMA } from '@/lib/tema';

const leer = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
const css = leer('src/app/globals.css');

describe('área segura', () => {
  it('la página llega a los bordes (viewport-fit=cover)', () => {
    expect(leer('src/app/layout.tsx')).toContain("viewportFit: 'cover'");
  });

  it('el margen inferior es el área segura solo en la app instalada; en Safari y en el PC, 0', () => {
    expect(css).toMatch(/:root\s*\{\s*--nova-seguro-abajo:\s*0px;/);
    expect(css).toMatch(/@media \(display-mode: standalone\)\s*\{\s*:root\s*\{\s*--nova-seguro-abajo:\s*env\(safe-area-inset-bottom, 0px\);/);
  });

  it('la barra inferior, el "+", los diálogos, la hoja "Más" y el final del contenido usan ese margen', () => {
    const archivos = [
      'src/components/nova/navegacion/BarraInferior.tsx',
      'src/components/nova/navegacion/BotonAgregar.tsx',
      'src/components/ui/Dialogo.tsx',
      'src/app/nova/layout.tsx',
      'src/components/nova/Chat.tsx',
      'src/components/nova/ConexionNova.tsx',
    ];
    for (const f of archivos) {
      const codigo = leer(f);
      expect(codigo, f).toContain('var(--nova-seguro-abajo)');
      expect(codigo, f).not.toContain('safe-area-inset-bottom');
    }
  });

  it('las pantallas de Nova y de acceso pintan la página con el fondo de Nova (no el azul del estilo anterior)', () => {
    expect(css).toMatch(/html:has\(\[data-nova-fondo\]\),\s*html:has\(\[data-nova-fondo\]\) body\s*\{\s*background: var\(--nova-fondo\);/);
    expect(leer('src/app/nova/layout.tsx')).toContain('data-nova-fondo');
    expect(leer('src/components/login/TarjetaAcceso.tsx')).toContain('data-nova-fondo');
  });
});

describe('color de la barra de estado según el tema', () => {
  const metas = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
  function poner() {
    document.head.innerHTML = '';
    for (const [media, color] of [['(prefers-color-scheme: light)', '#faf6f0'], ['(prefers-color-scheme: dark)', '#1a1613']]) {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      m.setAttribute('media', media as string);
      m.setAttribute('content', color as string);
      document.head.append(m);
    }
  }
  afterEach(() => {
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-tema');
  });

  it('con oscuro o claro elegido en Nova, todas toman ese fondo aunque el sistema diga otra cosa', () => {
    poner();
    aplicarColorBarra('oscuro');
    expect(metas().map((m) => [m.getAttribute('media'), m.content])).toEqual([[null, COLOR_FONDO.oscuro], [null, COLOR_FONDO.oscuro]]);
    aplicarTema('claro');
    expect(metas().map((m) => m.content)).toEqual([COLOR_FONDO.claro, COLOR_FONDO.claro]);
  });

  it('con automático, cada una vuelve a seguir al sistema', () => {
    poner();
    aplicarColorBarra('oscuro');
    aplicarColorBarra('automatico');
    expect(metas().map((m) => [m.getAttribute('media'), m.content])).toEqual([
      ['(prefers-color-scheme: light)', COLOR_FONDO.claro],
      ['(prefers-color-scheme: dark)', COLOR_FONDO.oscuro],
    ]);
  });

  it('el script del <head> también la ajusta antes de pintar', () => {
    poner();
    localStorage.setItem('nova-tema', 'oscuro');
    new Function(SCRIPT_TEMA)();
    expect(metas().every((m) => m.content === COLOR_FONDO.oscuro && !m.hasAttribute('media'))).toBe(true);
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
    aplicarColorBarra('automatico'); // y luego se puede volver a seguir al sistema
    expect(metas().map((m) => m.getAttribute('media'))).toEqual(['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)']);
    localStorage.removeItem('nova-tema');
  });

  it('los colores son los del token --nova-fondo de cada modo', () => {
    expect(css).toContain(`--nova-fondo: ${COLOR_FONDO.claro};`);
    expect(css).toContain(`--nova-fondo: ${COLOR_FONDO.oscuro};`);
  });
});
