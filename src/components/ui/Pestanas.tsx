'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { conservarScroll } from '@/lib/conservarScroll';
import { useEffect, useRef } from 'react';
import { CLASE_FOCO } from './Boton';
import { ATRIBUTO_PILDORA, estiloPildora, usePildora } from './usePildora';

export interface Pestana {
  href: string; // la pestaña va en la URL (?vista=..., ?estado=...), así se puede compartir y volver
  texto: string;
  activa: boolean;
}

/**
 * Pestañas en píldora (PLAN_AMPLIACION 3.2). Son enlaces: la activa lleva aria-current. Siempre en una
 * sola fila (E08): si no caben en el teléfono, se deslizan de lado en vez de partirse en dos líneas, y al
 * cargar la fila se corre para que la activa quede a la vista (sin animación). Con `envolverEnComputador` (selector de
 * materia de E17), desde 1024 px las que no caben bajan a otra línea en vez de mostrar la barra de desplazamiento.
 * E20b: la activa lleva una píldora que se desliza desde la anterior, también entre pantallas con la misma fila
 * (por ejemplo, las tres pestañas de Semestre), porque la última posición se recuerda por `etiqueta`.
 */
export function Pestanas({ etiqueta, pestanas, envolverEnComputador = false }: { etiqueta: string; pestanas: Pestana[]; envolverEnComputador?: boolean }) {
  const fila = useRef<HTMLElement>(null);
  const activa = pestanas.find((p) => p.activa)?.href;
  const pildora = usePildora(fila, `pestanas:${etiqueta}`, activa);
  // Una pestaña que solo cambia la consulta (?vista=, ?tipo=, ?materia=) se queda en la misma pantalla: la página no
  // sube. La que lleva a otra ruta (las secciones de Semestre) sí empieza arriba.
  const ruta = usePathname();

  useEffect(() => {
    const nav = fila.current;
    const elegida = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !elegida) return;
    const sobra = elegida.offsetLeft + elegida.offsetWidth - (nav.scrollLeft + nav.clientWidth);
    if (sobra > 0) nav.scrollLeft += sobra + 4;
    else if (elegida.offsetLeft < nav.scrollLeft) nav.scrollLeft = Math.max(0, elegida.offsetLeft - 4);
  }, [activa]);

  return (
    <nav ref={fila} aria-label={etiqueta} className={`relative flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-superficie-2 p-1 ${envolverEnComputador ? 'lg:flex-wrap lg:overflow-visible lg:rounded-2xl' : ''}`}>
      {pildora && <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 rounded-full bg-superficie shadow-suave" style={estiloPildora(pildora)} />}
      {pestanas.map(({ href, texto, activa: esActiva }) => (
        <Link
          key={href}
          href={href}
          scroll={href.split('?')[0] !== ruta}
          onClick={() => {
            if (href.split('?')[0] === ruta) conservarScroll(href);
          }}
          aria-current={esActiva ? 'page' : undefined}
          {...(esActiva ? { [ATRIBUTO_PILDORA]: '' } : {})}
          className={`relative z-10 shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 sm:px-4 ${CLASE_FOCO} ${
            esActiva ? `text-acento ${pildora ? '' : 'bg-superficie shadow-suave'}` : 'text-texto-suave hover:text-texto'
          }`}
        >
          {texto}
        </Link>
      ))}
    </nav>
  );
}
