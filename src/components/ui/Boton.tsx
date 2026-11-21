import type { ButtonHTMLAttributes } from 'react';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma';

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'bg-acento text-acento-texto shadow-suave hover:bg-acento/90',
  secundario: 'border border-borde bg-superficie text-texto hover:border-acento hover:bg-superficie-2',
  peligro: 'bg-peligro text-acento-texto hover:bg-peligro/90',
  fantasma: 'text-acento hover:bg-acento-suave',
};

/** Anillo de foco del color de acento, igual en todos los controles (PLAN_AMPLIACION 3.2). */
export const CLASE_FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  cargando?: boolean;
  /**
   * E20b (commit 3): terminó bien. El botón muestra un check que se dibuja y `textoListo`, y queda desactivado
   * (por ejemplo, mientras se vuelve a la pantalla anterior después de guardar).
   */
  listo?: boolean;
  textoListo?: string;
}

export function claseBoton(variante: VarianteBoton = 'primario'): string {
  // E20b: al tocarlo se hunde un poco (en el teléfono es la respuesta al toque); sin efecto si está desactivado.
  return `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:active:scale-100 ${CLASE_FOCO} disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]}`;
}

export function Boton({ variante = 'primario', cargando = false, listo = false, textoListo, disabled, children, className = '', ...resto }: Props) {
  return (
    <button
      type="button"
      {...resto}
      aria-busy={cargando || undefined}
      className={`${claseBoton(variante)} ${className}`}
      disabled={disabled || cargando || listo}
    >
      {listo && (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path className="nova-trazo-check" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
      {cargando && !listo && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {listo && textoListo ? textoListo : children}
    </button>
  );
}
