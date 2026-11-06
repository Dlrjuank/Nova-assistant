import type { ButtonHTMLAttributes } from 'react';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma';

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'bg-acento text-acento-texto shadow-suave hover:bg-acento/90',
  secundario: 'border border-borde bg-superficie text-texto hover:bg-superficie-2',
  peligro: 'bg-peligro text-acento-texto hover:bg-peligro/90',
  fantasma: 'text-acento hover:bg-acento-suave',
};

/** Anillo de foco del color de acento, igual en todos los controles (PLAN_AMPLIACION 3.2). */
export const CLASE_FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  cargando?: boolean;
}

export function claseBoton(variante: VarianteBoton = 'primario'): string {
  return `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-150 ${CLASE_FOCO} disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]}`;
}

export function Boton({ variante = 'primario', cargando = false, disabled, children, className = '', ...resto }: Props) {
  return (
    <button
      type="button"
      {...resto}
      aria-busy={cargando || undefined}
      className={`${claseBoton(variante)} ${className}`}
      disabled={disabled || cargando}
    >
      {cargando && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
