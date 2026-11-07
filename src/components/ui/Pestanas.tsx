'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { CLASE_FOCO } from './Boton';

export interface Pestana {
  href: string; // la pestaña va en la URL (?vista=..., ?estado=...), así se puede compartir y volver
  texto: string;
  activa: boolean;
}

/**
 * Pestañas en píldora (PLAN_AMPLIACION 3.2). Son enlaces: la activa lleva aria-current. Siempre en una
 * sola fila (E08): si no caben en el teléfono, se deslizan de lado en vez de partirse en dos líneas, y al
 * cargar la fila se corre para que la activa quede a la vista (sin animación).
 */
export function Pestanas({ etiqueta, pestanas }: { etiqueta: string; pestanas: Pestana[] }) {
  const fila = useRef<HTMLElement>(null);
  const activa = pestanas.find((p) => p.activa)?.href;

  useEffect(() => {
    const nav = fila.current;
    const elegida = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !elegida) return;
    const sobra = elegida.offsetLeft + elegida.offsetWidth - (nav.scrollLeft + nav.clientWidth);
    if (sobra > 0) nav.scrollLeft += sobra + 4;
    else if (elegida.offsetLeft < nav.scrollLeft) nav.scrollLeft = Math.max(0, elegida.offsetLeft - 4);
  }, [activa]);

  return (
    <nav ref={fila} aria-label={etiqueta} className="relative flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-superficie-2 p-1">
      {pestanas.map(({ href, texto, activa: esActiva }) => (
        <Link
          key={href}
          href={href}
          aria-current={esActiva ? 'page' : undefined}
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 sm:px-4 ${CLASE_FOCO} ${
            esActiva ? 'bg-superficie text-acento shadow-suave' : 'text-texto-suave hover:text-texto'
          }`}
        >
          {texto}
        </Link>
      ))}
    </nav>
  );
}
