'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useFocoAtrapado } from '@/components/nova/navegacion/useFocoAtrapado';
import { Boton } from './Boton';

/**
 * Diálogo modal: hoja inferior en el teléfono y recuadro centrado desde 640 px. Escape, "Cerrar" o tocar
 * fuera lo cierran; el foco queda atrapado y vuelve a quien lo abrió (`origen`). La página de fondo no se desplaza.
 */
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

  useEffect(() => {
    if (!abierto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [abierto]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50">
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
        className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-superficie px-4 pt-4 pb-[calc(1rem+var(--nova-seguro-abajo))] shadow-suave sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6"
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
    </div>
  );
}
