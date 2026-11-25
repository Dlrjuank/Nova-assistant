'use client';

import { useCallback, useEffect, useState } from 'react';

/** Cuánto se ve el estado "listo" de un botón antes de volver. */
export const LISTO_MS = 2500;

/**
 * E20b: el estado "listo" de un botón (cargando → listo → vuelve). Devuelve si está listo y la función que lo
 * enciende; se apaga solo a los `ms` milisegundos.
 */
export function useListo(ms = LISTO_MS): [boolean, () => void] {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!listo) return;
    const t = setTimeout(() => setListo(false), ms);
    return () => clearTimeout(t);
  }, [listo, ms]);
  const marcar = useCallback(() => setListo(true), []);
  return [listo, marcar];
}
