'use client';

import { useEffect } from 'react';
import { textoCookieMateria } from '@/lib/reglas/materiaElegida';

/** E17 (ajuste): recuerda en este navegador la última materia abierta, para "Objetivos y plan". No muestra nada. */
export function RecordarMateria({ id }: { id: string }) {
  useEffect(() => {
    try {
      document.cookie = textoCookieMateria(id);
    } catch {
      // Sin cookies (modo privado estricto) se usa la más reciente: no pasa nada.
    }
  }, [id]);
  return null;
}
