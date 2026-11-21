'use client';

import { useEffect, useRef, useState } from 'react';
import { detalleCelebracion, EVENTO_CELEBRAR, type Celebracion as Datos } from '@/lib/celebracion';

/** Cuánto se ve el aviso. */
const DURACION_MS = 2800;

/** Los destellos: ángulo y color (tokens de la paleta, nunca colores sueltos). */
const DESTELLOS: ReadonlyArray<{ angulo: number; clase: string }> = [
  { angulo: 0, clase: 'bg-acento' },
  { angulo: 60, clase: 'bg-estrella' },
  { angulo: 120, clase: 'bg-cat-ambar' },
  { angulo: 180, clase: 'bg-acento' },
  { angulo: 240, clase: 'bg-estrella' },
  { angulo: 300, clase: 'bg-exito' },
];

/**
 * E20b (commit 3): al completar una tarea, un aviso de cristal con un check que se dibuja y seis destellos, sin
 * exagerar. Vive en el layout de Nova y escucha `celebrar()` (src/lib/celebracion.ts). La región `status` está
 * siempre montada para que los lectores de pantalla lean el texto. Con "reducir movimiento" el aviso aparece
 * quieto y sin destellos (la regla global de globals.css deja las animaciones en su estado final).
 */
export function Celebracion() {
  const [actual, setActual] = useState<(Datos & { n: number }) | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const alCelebrar = (e: Event) => {
      const detalle = (e as CustomEvent<Datos>).detail;
      // `n` cambia en cada celebración: con la `key`, dos seguidas vuelven a animarse.
      setActual((previa) => ({ ...detalle, n: (previa?.n ?? 0) + 1 }));
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setActual(null), DURACION_MS);
    };
    window.addEventListener(EVENTO_CELEBRAR, alCelebrar);
    return () => {
      window.removeEventListener(EVENTO_CELEBRAR, alCelebrar);
      clearTimeout(temporizador.current);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(10rem+var(--nova-seguro-abajo))] z-50 flex justify-center px-4 lg:bottom-8 lg:pl-[calc(var(--nova-ancho-lateral)+1.5rem)]"
    >
      {actual && (
        <div
          key={actual.n}
          data-celebracion
          className="nova-celebrar flex max-w-sm min-w-0 items-center gap-3 rounded-2xl border border-borde bg-cristal py-3 pr-5 pl-3 shadow-suave backdrop-blur-xl"
        >
          <span aria-hidden="true" className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-exito text-acento-texto">
            {DESTELLOS.map((d) => (
              <span
                key={d.angulo}
                className={`nova-destello absolute top-1/2 left-1/2 size-1.5 rounded-full ${d.clase}`}
                style={{ '--nova-angulo': `${d.angulo}deg` } as React.CSSProperties}
              />
            ))}
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path className="nova-trazo-check" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-display text-sm font-semibold text-texto">¡Tarea completada!</span>
            <span className="truncate text-xs text-texto-suave">{detalleCelebracion(actual)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
