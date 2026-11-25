// E20b (versión del 2026-11-25): la pantalla de carga con la Estrella nova, solo al abrir la app en frío.
// Cometa que dibuja el anillo, estrella que se enciende, y el portal que revela la app; 1,5 s como máximo.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PantallaCarga } from '@/components/nova/PantallaCarga';
import {
  alVerseLaApp,
  ATRIBUTO_CARGA,
  COLOR_BARRA_CARGA,
  EVENTO_FIN_CARGA,
  MS_ANTES_DEL_PORTAL,
  MS_DESVANECER,
  MS_PORTAL,
  SCRIPT_CARGA,
} from '@/lib/pantallaCarga';
import { aplicarColorBarra, COLOR_FONDO } from '@/lib/tema';

const html = document.documentElement;
let cuadros: FrameRequestCallback[] = [];
let reloj = 0;
let quieto = false;

/** Pinta un cuadro: corre los requestAnimationFrame pendientes con la hora del reloj falso. */
function cuadro() {
  const pendientes = cuadros;
  cuadros = [];
  for (const cb of pendientes) cb(reloj);
}
function avanzar(ms: number) {
  reloj += ms;
  vi.advanceTimersByTime(ms);
}

function abrir({ referrer = '', tipo = 'navigate', cargando = true }: { referrer?: string; tipo?: string; cargando?: boolean } = {}) {
  Object.defineProperty(document, 'referrer', { configurable: true, get: () => referrer });
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => (cargando ? 'loading' : 'complete') });
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: tipo } as unknown as PerformanceEntry]);
  new Function(SCRIPT_CARGA)();
}
const metaCarga = () => document.head.querySelector(`meta[${ATRIBUTO_CARGA}]`);
const app = () => document.querySelector<HTMLElement>('[data-nova-fondo]')!;
/** El primer cuadro ya se pintó (el script lo anota en el cuadro siguiente). */
function pintado() {
  cuadro();
  vi.advanceTimersByTime(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  reloj = 0;
  cuadros = [];
  quieto = false;
  vi.spyOn(performance, 'now').mockImplementation(() => reloj);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cuadros.push(cb);
    return cuadros.length;
  });
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: quieto && q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
  document.head.innerHTML = `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${COLOR_FONDO.claro}">`;
  document.body.innerHTML = `<div class="nova-carga"><svg></svg></div><div class="nova-carga-aro"></div><div data-nova-fondo></div>`;
  vi.spyOn(document.querySelector('.nova-carga svg')!, 'getBoundingClientRect').mockReturnValue({ left: 139, top: 370, width: 112, height: 112 } as DOMRect);
});
afterEach(() => {
  // Cada script deja su escucha de DOMContentLoaded: se consume aquí para que no corra en la prueba siguiente.
  document.dispatchEvent(new Event('DOMContentLoaded'));
  vi.clearAllTimers();
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
  });

  it('no en una recarga, ni al volver atrás, ni al llegar desde otra página de Nova (login, cargas sin conexión)', () => {
    for (const caso of [{ tipo: 'reload' }, { tipo: 'back_forward' }, { referrer: `${location.origin}/login` }]) {
      abrir(caso);
      expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
    }
    expect(metaCarga()).toBeNull();
  });

  it('sí al llegar desde otro sitio (es la primera carga de la pestaña)', () => {
    abrir({ referrer: 'https://www.google.com/' });
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('');
  });
});

describe('la secuencia: cometa, estrella y portal (1,5 s como máximo)', () => {
  it('con la app lista enseguida, el portal se abre al terminar el cometa y la estrella (1 s) y dura 0,5 s', () => {
    const fin = vi.fn();
    window.addEventListener(EVENTO_FIN_CARGA, fin);
    abrir();
    pintado();
    avanzar(50);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe(''); // el cometa y la estrella siguen
    avanzar(MS_ANTES_DEL_PORTAL - 50);
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('portal');
    expect(metaCarga()).toBeNull(); // la barra vuelve al tema al abrirse el portal
    expect(fin).toHaveBeenCalledTimes(1); // los números de Inicio cuentan ya
    // El círculo crece desde la estrella (centro de su svg) y revela la app por dentro.
    expect(app().style.clipPath).toMatch(/^circle\(52\.\dpx at 195\.0px 426\.0px\)$/);
    cuadro();
    avanzar(MS_PORTAL / 2);
    cuadro();
    const aro = document.querySelector<HTMLElement>('.nova-carga-aro')!;
    expect(Number(aro.style.opacity)).toBeCloseTo(0.5, 1);
    avanzar(MS_PORTAL / 2);
    cuadro();
    // A los 1,5 s ya no queda nada: ni la pantalla ni el recorte de la app.
    expect(reloj).toBe(MS_ANTES_DEL_PORTAL + MS_PORTAL);
    expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
    expect(app().style.clipPath).toBe('');
    window.removeEventListener(EVENTO_FIN_CARGA, fin);
  });

  it('si la app tarda más, la estrella espera encendida y el portal se abre en cuanto está lista', () => {
    abrir();
    pintado();
    avanzar(2600);
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    vi.advanceTimersByTime(0);
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('portal');
  });

  it('si el portal no recibe cuadros (pestaña oculta a mitad), igual termina y no deja la app recortada', () => {
    abrir();
    pintado();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    avanzar(MS_ANTES_DEL_PORTAL);
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('portal');
    avanzar(MS_PORTAL + 700);
    expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
    expect(app().style.clipPath).toBe('');
  });

  it('si la app está lista antes del primer cuadro, la secuencia corre igual y el reloj empieza al pintarse', () => {
    abrir();
    avanzar(200); // el navegador aún no pinta
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('');
    pintado(); // primer cuadro a los 200 ms
    avanzar(MS_ANTES_DEL_PORTAL - 1);
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('');
    avanzar(1);
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('portal');
  });

  it('con la pestaña oculta, se quita sin animar y avisa igual', () => {
    const fin = vi.fn();
    window.addEventListener(EVENTO_FIN_CARGA, fin);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    abrir();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
    expect(fin).toHaveBeenCalledTimes(1);
    Reflect.deleteProperty(document, 'visibilityState');
    window.removeEventListener(EVENTO_FIN_CARGA, fin);
  });

  it('con "reducir movimiento": sin cometa ni portal, solo un desvanecido corto en cuanto está lista', () => {
    quieto = true;
    abrir();
    pintado();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(html.getAttribute(ATRIBUTO_CARGA)).toBe('saliendo');
    expect(app().style.clipPath).toBe('');
    avanzar(MS_DESVANECER + 50);
    expect(html.hasAttribute(ATRIBUTO_CARGA)).toBe(false);
  });

  it('en la app instalada del iPhone, la estrella va al centro de la pantalla completa', () => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    vi.stubGlobal('innerHeight', 793);
    Object.defineProperty(screen, 'height', { configurable: true, value: 852 });
    abrir();
    expect(html.style.getPropertyValue('--nova-carga-y')).toBe(`${793 - 852 / 2}px`);
    Reflect.deleteProperty(navigator, 'standalone');
  });
});

describe('los números esperan a que se vea la app', () => {
  it('alVerseLaApp: sin pantalla de carga corre enseguida; con ella, al abrirse el portal', () => {
    const listo = vi.fn();
    alVerseLaApp(listo);
    expect(listo).toHaveBeenCalledTimes(1);
    html.setAttribute(ATRIBUTO_CARGA, '');
    const otro = vi.fn();
    alVerseLaApp(otro);
    expect(otro).not.toHaveBeenCalled();
    window.dispatchEvent(new Event(EVENTO_FIN_CARGA));
    expect(otro).toHaveBeenCalledTimes(1);
  });
});

describe('la pantalla', () => {
  it('va en el HTML inicial: el script antes de la pantalla, con el cometa, la estrella, el texto y el aro', () => {
    const marcado = renderToStaticMarkup(<PantallaCarga />);
    expect(marcado.indexOf('<script>')).toBeLessThan(marcado.indexOf('class="nova-carga"'));
    expect(marcado).toContain('role="status" aria-label="Cargando Nova"');
    expect(marcado).toContain('d="M60 18 L67 53 L102 60 L67 67 L60 102 L53 67 L18 60 L53 53 Z"');
    for (const clase of ['nova-carga-trazo', 'nova-carga-cola', 'nova-carga-cometa', 'nova-carga-estrella', 'nova-carga-respira', 'nova-carga-aro']) {
      expect(marcado).toContain(`class="${clase}"`);
    }
    expect(marcado).toContain('<p class="nova-carga-nombre">Nova</p>');
    expect(marcado).toContain('<p class="nova-carga-frase">Tu noche de estudio, en orden.</p>');
    // De frente: el anillo empieza arriba, sin perspectiva ni inclinación.
    expect(marcado).toContain('transform="rotate(-90 60 60)"');
    expect(marcado).not.toMatch(/perspective|rotateX|rotateY|skew/);
  });

  it('solo en el layout de Nova, no en la Entrada', () => {
    const leer = (r: string) => readFileSync(join(process.cwd(), r), 'utf8');
    expect(leer('src/app/nova/layout.tsx')).toContain('<PantallaCarga />');
    expect(leer('src/app/layout.tsx')).not.toContain('PantallaCarga');
    expect(leer('src/components/login/EntradaNova.tsx')).not.toContain('PantallaCarga');
  });

  it('siempre oscura, con los tiempos pedidos, y con "reducir movimiento" sin cometa ni portal', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n');
    const raiz = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    expect(raiz).toContain(`--nova-carga-fondo: ${COLOR_FONDO.oscuro};`);
    expect(css.match(/--nova-carga-fondo:/g)).toHaveLength(1); // no cambia con el tema
    expect(css).toMatch(/\.nova-carga \{\n {2}display: none;/);
    expect(css).toContain('animation: nova-carga-trazo 0.7s'); // el cometa dibuja el anillo en 0,7 s
    expect(css).toContain('animation: nova-carga-girar 0.7s');
    expect(css).toContain('animation: nova-carga-encender 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) 0.68s both'); // rebote
    expect(css).toContain("html[data-nova-carga='portal'] [data-nova-fondo] {\n  position: relative;\n  z-index: 10000;");
    expect(MS_ANTES_DEL_PORTAL + MS_PORTAL).toBeLessThanOrEqual(1500);
    const reducir = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducir).toMatch(/\.nova-carga-trazo,[\s\S]*\.nova-carga-cometa,[\s\S]*animation: none !important;/);
    expect(reducir).toContain('transition-duration: 0.35s !important;');
  });

  it('el tema no toca el color de la barra de la pantalla de carga', () => {
    abrir();
    aplicarColorBarra('claro');
    expect(metaCarga()?.getAttribute('content')).toBe(COLOR_BARRA_CARGA);
  });
});
