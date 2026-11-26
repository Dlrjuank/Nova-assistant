'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useLayoutEffect } from 'react';
import { tomarScrollPendiente } from '@/lib/conservarScroll';

/**
 * Deja la página donde estaba al cambiar de filtro o de pestaña en la misma pantalla (ver `conservarScroll`). Se
 * restaura antes de pintar y otra vez en el cuadro siguiente, después de que Next enfoque la página nueva.
 */
export function ConservarScroll() {
  const ruta = usePathname();
  const consulta = useSearchParams().toString();
  useLayoutEffect(() => {
    const y = tomarScrollPendiente(`${ruta}${consulta ? `?${consulta}` : ''}`);
    if (y === null) return;
    const volver = () => window.scrollTo({ top: y, behavior: 'instant' });
    volver();
    const cuadro = requestAnimationFrame(volver);
    return () => cancelAnimationFrame(cuadro);
  }, [ruta, consulta]);
  return null;
}
