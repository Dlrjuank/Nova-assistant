'use client';

import { useEffect, type RefObject } from 'react';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Mientras `abierto`: el foco entra al contenedor, Tab y Shift+Tab no salen de él y Escape cierra.
 * Al cerrar, el foco vuelve al botón que lo abrió (PLAN_AMPLIACION 4.3).
 */
export function useFocoAtrapado(
  abierto: boolean,
  contenedor: RefObject<HTMLElement | null>,
  disparador: RefObject<HTMLElement | null>,
  cerrar: () => void,
): void {
  useEffect(() => {
    if (!abierto) return;
    const nodo = contenedor.current;
    const origen = disparador.current;
    const enfocables = () => Array.from(nodo?.querySelectorAll<HTMLElement>(ENFOCABLES) ?? []);
    enfocables()[0]?.focus();

    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cerrar();
        return;
      }
      if (evento.key !== 'Tab') return;
      const lista = enfocables();
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (!primero || !ultimo) return;
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', alPresionar);
    return () => {
      document.removeEventListener('keydown', alPresionar);
      origen?.focus();
    };
  }, [abierto, contenedor, disparador, cerrar]);
}
