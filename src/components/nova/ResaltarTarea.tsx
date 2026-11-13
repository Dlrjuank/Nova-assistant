'use client';

import { useEffect } from 'react';

const DURACION_MS = 6000;

/**
 * E11c (5.10): al abrir una notificación, Tareas llega con `?tarea=<id>`. Lleva la vista a esa tarea (la fila de la
 * tabla o la tarjeta del teléfono, la que se vea) y la resalta unos segundos con `data-resaltada` (globals.css).
 * Con "reducir movimiento", sin desplazamiento suave.
 */
export function ResaltarTarea({ id }: { id: string }) {
  useEffect(() => {
    const visible = [...document.querySelectorAll<HTMLElement>('[data-tarea-id]')].find(
      (e) => e.dataset.tareaId === id && e.offsetParent !== null,
    );
    if (!visible) return;
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    visible.scrollIntoView?.({ block: 'center', behavior: quieto ? 'auto' : 'smooth' });
    visible.setAttribute('data-resaltada', '');
    const t = window.setTimeout(() => visible.removeAttribute('data-resaltada'), DURACION_MS);
    return () => {
      window.clearTimeout(t);
      visible.removeAttribute('data-resaltada');
    };
  }, [id]);
  return null;
}
