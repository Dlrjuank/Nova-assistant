'use client';

import { useEffect, useRef, type RefObject } from 'react';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
const CAMPOS = 'input:not([disabled]):not([type="radio"]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

/**
 * Mientras `abierto`: el foco entra al contenedor (al primer campo si hay uno), Tab y Shift+Tab no salen
 * de él y Escape cierra. Al cerrar, el foco vuelve al botón que lo abrió (PLAN_AMPLIACION 4.3).
 * `cerrar` se guarda en una referencia: si cambiara en cada render (una función nueva por tecla), el efecto
 * no debe reiniciarse, porque eso devolvería el foco al botón de origen en medio de la escritura.
 */
export function useFocoAtrapado(
  abierto: boolean,
  contenedor: RefObject<HTMLElement | null>,
  disparador: RefObject<HTMLElement | null>,
  cerrar: () => void,
): void {
  const cerrarActual = useRef(cerrar);
  cerrarActual.current = cerrar;

  useEffect(() => {
    if (!abierto) return;
    const nodo = contenedor.current;
    const origen = disparador.current;
    const enfocables = () => Array.from(nodo?.querySelectorAll<HTMLElement>(ENFOCABLES) ?? []);
    (nodo?.querySelector<HTMLElement>(CAMPOS) ?? enfocables()[0])?.focus();

    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cerrarActual.current();
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
  }, [abierto, contenedor, disparador]);
}
