'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** A cuántos px del final se considera que el usuario "está al final" (no subió a leer algo anterior). */
export const UMBRAL_CERCA_DEL_FINAL = 120;
const MARGEN = 16;

export interface ZonaVisible {
  arriba: number;
  abajo: number;
}

/**
 * Cuánto bajar (px, puede ser negativo) para que el final de la conversación quede justo sobre el borde
 * inferior visible, sin esconder el comienzo del último mensaje si es más alto que la pantalla.
 * Todo en coordenadas de la ventana (getBoundingClientRect).
 */
export function calcularDesplazamiento(fin: number, inicioUltimo: number | null, zona: ZonaVisible): number {
  const hastaElFin = fin + MARGEN - zona.abajo;
  if (hastaElFin <= 0) return 0; // el final ya se ve
  if (inicioUltimo === null) return hastaElFin;
  return Math.min(hastaElFin, inicioUltimo - MARGEN - zona.arriba);
}

/**
 * Zona realmente visible: la del visualViewport (en el teléfono, sin el teclado abierto) menos la barra
 * inferior fija de Nova si se está viendo.
 */
export function zonaVisible(): ZonaVisible {
  const vv = window.visualViewport;
  const arriba = vv ? vv.offsetTop : 0;
  let abajo = arriba + (vv ? vv.height : window.innerHeight);
  const barra = document.querySelector<HTMLElement>('[data-barra-inferior]');
  if (barra && barra.getClientRects().length > 0) {
    abajo = Math.min(abajo, barra.getBoundingClientRect().top);
  }
  return { arriba, abajo };
}

function prefiereMenosMovimiento(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Lleva la vista al último mensaje del chat (PLAN_AMPLIACION 5.2, pedido del usuario):
 * - al enviar una pregunta, siempre;
 * - al llegar la respuesta, solo si el usuario sigue al final; si subió a leer algo anterior, no lo mueve
 *   y `lejos` queda en true para mostrar "Ir al final";
 * - si cambia la zona visible (el teclado del teléfono se abre o se cierra) y estaba al final, lo mantiene;
 * - sin animación para quien prefiere menos movimiento.
 * `fin` es el elemento que cierra la conversación (el formulario de pregunta); `ultimo` devuelve el último mensaje.
 */
export function useSeguirConversacion(fin: RefObject<HTMLElement | null>, ultimo: () => HTMLElement | null) {
  const [lejos, setLejos] = useState(false);
  const alFinal = useRef(true);
  const bajando = useRef(false);

  const distanciaAlFinal = useCallback(() => {
    const nodo = fin.current;
    if (!nodo) return 0;
    return nodo.getBoundingClientRect().bottom - zonaVisible().abajo;
  }, [fin]);

  const bajar = useCallback(
    (animar: boolean) => {
      const nodo = fin.current;
      if (!nodo || typeof window.scrollBy !== 'function') return;
      const delta = calcularDesplazamiento(
        nodo.getBoundingClientRect().bottom,
        ultimo()?.getBoundingClientRect().top ?? null,
        zonaVisible(),
      );
      alFinal.current = true;
      setLejos(false);
      if (Math.abs(delta) < 2) return;
      bajando.current = true;
      window.scrollBy({ top: delta, behavior: animar && !prefiereMenosMovimiento() ? 'smooth' : 'auto' });
      // Mientras baja, los eventos de scroll no cuentan como "el usuario subió".
      window.setTimeout(() => {
        bajando.current = false;
      }, 700);
    },
    [fin, ultimo],
  );

  useEffect(() => {
    function alDesplazar() {
      if (bajando.current) return;
      const cerca = distanciaAlFinal() <= UMBRAL_CERCA_DEL_FINAL;
      alFinal.current = cerca;
      if (cerca) setLejos(false);
    }
    function alCambiarZona() {
      // El teclado se abrió o se cerró: si estaba al final, que el último mensaje siga a la vista.
      if (alFinal.current) bajar(false);
    }
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.visualViewport?.addEventListener('resize', alCambiarZona);
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      window.visualViewport?.removeEventListener('resize', alCambiarZona);
    };
  }, [distanciaAlFinal, bajar]);

  /** Llegó contenido nuevo que no envió el usuario (la respuesta, un error): baja solo si estaba al final. */
  const llegoAlgo = useCallback(() => {
    if (alFinal.current) bajar(true);
    else setLejos(true);
  }, [bajar]);

  return { lejos, bajar, llegoAlgo };
}
