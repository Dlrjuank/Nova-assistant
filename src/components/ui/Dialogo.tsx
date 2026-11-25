'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useFocoAtrapado } from '@/components/nova/navegacion/useFocoAtrapado';
import { Boton } from './Boton';

/**
 * Diálogo modal: hoja inferior en el teléfono y recuadro centrado desde 640 px. Escape, "Cerrar" o tocar
 * fuera lo cierran; el foco queda atrapado y vuelve a quien lo abrió (`origen`). La página de fondo no se desplaza.
 * E20b (iPhone, pedido del usuario): con el teclado abierto, el diálogo ocupa solo la parte visible de la pantalla
 * (`visualViewport`), deja libre la franja de arriba (área segura) y lleva el campo enfocado a la vista dentro de la
 * hoja. Antes la hoja medía el 85 % de la pantalla entera y, al abrir el teclado, el iPhone la subía por detrás de
 * la franja de arriba: el título y el campo quedaban tapados.
 */

/** La parte de la pantalla que se ve (sin el teclado), en píxeles; null donde el navegador no la informa. */
function useVisorVisible(activo: boolean): { arriba: number; alto: number } | null {
  const [visor, setVisor] = useState<{ arriba: number; alto: number } | null>(null);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!activo || !vv) return;
    const medir = () => setVisor({ arriba: vv.offsetTop, alto: vv.height });
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => {
      vv.removeEventListener('resize', medir);
      vv.removeEventListener('scroll', medir);
    };
  }, [activo]);
  return activo ? visor : null;
}
export function Dialogo({
  abierto,
  titulo,
  descripcion,
  alCerrar,
  origen,
  children,
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: ReactNode;
  alCerrar: () => void;
  origen: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const toqueEnFondo = useRef(false);
  useFocoAtrapado(abierto, caja, origen, alCerrar);
  const visor = useVisorVisible(abierto);

  // Al enfocar un campo (o al cambiar el alto visible porque se abrió el teclado), el campo queda a la vista dentro
  // de la hoja, que se desplaza sola si no cabe entera.
  useEffect(() => {
    const hoja = caja.current;
    const activo = document.activeElement;
    if (!abierto || !hoja || !(activo instanceof HTMLElement) || !hoja.contains(activo) || activo === hoja) return;
    if (!activo.matches('input, textarea, select')) return;
    if (typeof activo.scrollIntoView === 'function') activo.scrollIntoView({ block: 'nearest' });
  }, [abierto, visor?.alto]);

  useEffect(() => {
    if (!abierto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [abierto]);

  if (!abierto || typeof document === 'undefined') return null;
  // E20b: en <body>, para que ningún bloque animado o con filtro de la página cambie dónde se ubica.
  return createPortal(
    <div
      data-dialogo-fondo
      className="fixed inset-x-0 top-0 z-50 h-dvh"
      style={visor ? ({ top: `${visor.arriba}px`, height: `${visor.alto}px` } satisfies CSSProperties) : undefined}
    >
      {/* Tocar fuera cierra, pero solo si el toque empezó en el fondo: al abrir con una presión larga, el
          navegador manda el clic de soltar el dedo al fondo, y eso no debe cerrar el diálogo recién abierto. */}
      <div
        data-testid="fondo-dialogo"
        className="absolute inset-0 bg-texto/40"
        onPointerDown={() => {
          toqueEnFondo.current = true;
        }}
        onClick={() => {
          if (toqueEnFondo.current) alCerrar();
          toqueEnFondo.current = false;
        }}
      />
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-dialogo"
        onFocus={(e) => {
          const campo = e.target;
          if (campo instanceof HTMLElement && campo.matches('input, textarea, select') && typeof campo.scrollIntoView === 'function') {
            // El teclado tarda en abrir: se vuelve a llevar a la vista cuando el alto visible cambia (efecto de arriba).
            campo.scrollIntoView({ block: 'nearest' });
          }
        }}
        className="absolute inset-x-0 bottom-0 flex max-h-[min(85dvh,calc(100%-env(safe-area-inset-top,0px)-0.75rem))] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-superficie px-4 pt-4 pb-[calc(1rem+var(--nova-seguro-abajo))] shadow-suave sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="titulo-dialogo" className="text-lg font-semibold text-texto">
              {titulo}
            </h2>
            {descripcion && <p className="mt-1 text-sm text-texto-suave">{descripcion}</p>}
          </div>
          <Boton variante="fantasma" data-sin-conexion="permitido" onClick={alCerrar} aria-label="Cerrar" className="min-h-9 shrink-0 px-2 py-1.5">
            <X aria-hidden="true" className="size-4" />
          </Boton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
