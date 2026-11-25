// E20b: la pantalla de carga con la Estrella nova, solo al abrir la app en frío, sin tiempos mínimos.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PantallaCarga } from '@/components/nova/PantallaCarga';
import { ATRIBUTO_CARGA, COLOR_BARRA_CARGA, MS_DESVANECER, SCRIPT_CARGA } from '@/lib/pantallaCarga';
import { aplicarColorBarra, COLOR_FONDO } from '@/lib/tema';

const html = document.documentElement;
let pintar: (() => void) | null = null;

function abrir({ referrer = '', tipo = 'navigate', cargando = true }: { referrer?: string; tipo?: string; cargando?: boolean } = {}) {
  Object.defineProperty(document, 'referrer', { configurable: true, get: () => referrer });
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => (cargando ? 'loading' : 'complete') });
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: tipo } as unknown as PerformanceEntry]);
  new Function(SCRIPT_CARGA)();
}
const metaCarga = () => document.head.querySelector(`meta[${ATRIBUTO_CARGA}]`);

beforeEach(() => {
  vi.useFakeTimers();
  pintar = null;
  // El primer cuadro se "pinta" cuando la prueba lo dice.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pintar = () => cb(0);
    return 1;
  });
  document.head.innerHTML = `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${COLOR_FONDO.claro}">`;
});
afterEach(() => {
  html.removeAttribute(ATRIBUTO_CARGA);
  html.removeAttribute('style');
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cuándo se muestra', () => {
  it('al abrir en frío: se muestra y la barra de estado toma el fondo oscuro, primera en el <head>', () => {
    abrir();
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('');
    expect(document.head.firstElementChild).toBe(metaCarga());
    // El mismo color, con otro texto que la theme-color de Next, para que React no la tome como suya.
    expect(metaCarga()?.getAttribute('content')).toBe(COLOR_BARRA_CARGA);
    expect(COLOR_BARRA_CARGA).toBe('#14110F');
    expect(COLOR_BARRA_CARGA).not.toBe(COLOR_FONDO.oscuro);
  });

  it('no en una recarga, ni al volver atrás, ni al llegar desde otra página de Nova (login, cargas sin conexión)', () => {
    abrir({ tipo: 'reload' });
    expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
    abrir({ tipo: 'back_forward' });
    expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
    abrir({ referrer: `${location.origin}/login` });
    expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
    expect(metaCarga()).toBeNull();
  });

  it('sí al llegar desde otro sitio (es la primera carga de la pestaña)', () => {
    abrir({ referrer: 'https://www.google.com/' });
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('');
  });
});

describe('cuándo se va (sin tiempo mínimo)', () => {
  it('en cuanto el documento está completo se desvanece, y después se quita', () => {
    abrir();
    pintar!();
    vi.advanceTimersByTime(0); // ya se pintó el primer cuadro
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('saliendo');
    expect(metaCarga()).toBeNull(); // la barra vuelve al color del tema al empezar a desvanecerse
    vi.advanceTimersByTime(MS_DESVANECER + 50);
    expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
  });

  it('si la carga terminó antes del primer cuadro, se quita sin desvanecer (no parpadea)', () => {
    abrir();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
  });

  it('si el documento ya estaba completo, no se queda puesta', () => {
    abrir({ cargando: false });
    expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
  });

  it('en la app instalada del iPhone, la estrella va al centro de la pantalla completa, como en la imagen de arranque', () => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    vi.stubGlobal('innerHeight', 793);
    Object.defineProperty(screen, 'height', { configurable: true, value: 852 });
    abrir();
    expect(html.style.getPropertyValue('--nova-carga-y')).toBe(`${793 - 852 / 2}px`);
    Reflect.deleteProperty(navigator, 'standalone');
  });
});

describe('la pantalla', () => {
  it('va en el HTML inicial: el script antes de la pantalla, con role="status" y la estrella del diseño', () => {
    const marcado = renderToStaticMarkup(<PantallaCarga />);
    expect(marcado.indexOf('<script>')).toBeLessThan(marcado.indexOf('class="nova-carga"'));
    expect(marcado).toContain('role="status" aria-label="Cargando Nova"');
    expect(marcado).toContain('d="M60 18 L67 53 L102 60 L67 67 L60 102 L53 67 L18 60 L53 53 Z"');
    expect(marcado.match(/class="nova-carga-onda/g)).toHaveLength(2);
  });

  it('solo en el layout de Nova, no en la Entrada', () => {
    const leer = (r: string) => readFileSync(join(process.cwd(), r), 'utf8');
    expect(leer('src/app/nova/layout.tsx')).toContain('<PantallaCarga />');
    expect(leer('src/app/layout.tsx')).not.toContain('PantallaCarga');
    expect(leer('src/components/login/EntradaNova.tsx')).not.toContain('PantallaCarga');
  });

  it('siempre oscura, oculta salvo con el atributo, y con "reducir movimiento" quieta pero con el desvanecido', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const raiz = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    expect(raiz).toContain(`--nova-carga-fondo: ${COLOR_FONDO.oscuro};`);
    expect(raiz).toContain('--nova-carga-estrella: #f2a47c;');
    expect(css.match(/--nova-carga-fondo:/g)).toHaveLength(1); // no cambia con el tema
    expect(css).toMatch(/\.nova-carga \{\n {2}display: none;/);
    expect(css).toContain("html[data-nova-carga='saliendo'] .nova-carga {\n  opacity: 0;");
    const reducir = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducir).toContain('.nova-carga-onda,\n  .nova-carga-latido,\n  .nova-carga-brillo {\n    animation: none !important;');
    expect(reducir).toContain('transition-duration: 0.35s !important;');
  });

  it('el tema no toca el color de la barra de la pantalla de carga', () => {
    abrir();
    aplicarColorBarra('claro');
    expect(metaCarga()?.getAttribute('content')).toBe(COLOR_BARRA_CARGA);
  });
});
