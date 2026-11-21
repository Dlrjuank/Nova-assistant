'use client';

import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/** Posición y tamaño de la píldora, relativos a su contenedor. */
export interface CajaPildora {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** La primera vez que se coloca no se anima (aparece donde va). */
  animar: boolean;
}

/** Atributo que marca, dentro del contenedor, el elemento activo bajo el que va la píldora. */
export const ATRIBUTO_PILDORA = 'data-pildora-activa';

// La última posición de cada fila de opciones: al cambiar de pantalla la fila se vuelve a montar y la píldora sale
// de donde estaba (en otra pestaña) hacia la nueva, en vez de aparecer de golpe.
const memoria = new Map<string, Omit<CajaPildora, 'animar'>>();

const useEfectoTemprano = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * E20b (commit 1): la píldora que se desliza a la opción activa (barra lateral, barra inferior y pestañas).
 * Mide el elemento con ATRIBUTO_PILDORA dentro de `contenedor` (que debe ser su padre posicionado) cada vez que
 * cambia `activa` o el tamaño. Devuelve null mientras no hay nada que marcar: entonces la opción activa usa su
 * propio fondo, así el primer dibujo (y el HTML del servidor) ya la marcan. Con "reducir movimiento", la regla
 * global de globals.css deja la transición en 0 y la píldora salta directo.
 */
export function usePildora(contenedor: RefObject<HTMLElement | null>, clave: string, activa: string | undefined): CajaPildora | null {
  const [caja, setCaja] = useState<CajaPildora | null>(null);

  useEfectoTemprano(() => {
    const c = contenedor.current;
    const medir = (animar: boolean) => {
      const el = c?.querySelector<HTMLElement>(`[${ATRIBUTO_PILDORA}]`);
      if (!c || !el || el.offsetWidth === 0) {
        setCaja(null);
        return;
      }
      const nueva = { x: el.offsetLeft, y: el.offsetTop, ancho: el.offsetWidth, alto: el.offsetHeight };
      memoria.set(clave, nueva);
      setCaja({ ...nueva, animar });
    };
    const anterior = memoria.get(clave);
    let cuadro = 0;
    if (anterior && activa !== undefined) {
      // Primero donde estaba, y en el cuadro siguiente hacia la nueva (con transición).
      setCaja({ ...anterior, animar: false });
      cuadro = requestAnimationFrame(() => {
        cuadro = requestAnimationFrame(() => medir(true));
      });
    } else {
      medir(false);
    }
    // El observador avisa una vez al empezar: esa se ignora para no cortar el deslizamiento.
    let primera = true;
    const observador =
      typeof ResizeObserver === 'undefined' || !c
        ? null
        : new ResizeObserver(() => {
            if (primera) primera = false;
            else medir(false);
          });
    if (c) observador?.observe(c);
    return () => {
      cancelAnimationFrame(cuadro);
      observador?.disconnect();
    };
  }, [contenedor, clave, activa]);

  return caja;
}

/** El estilo del elemento que hace de píldora. */
export function estiloPildora(caja: CajaPildora): CSSProperties {
  return {
    width: caja.ancho,
    height: caja.alto,
    transform: `translate(${caja.x}px, ${caja.y}px)`,
    transition: caja.animar ? 'transform 0.28s cubic-bezier(0.2, 0.7, 0.2, 1), width 0.28s, height 0.28s' : 'none',
  };
}
