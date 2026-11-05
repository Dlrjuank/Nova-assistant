import type { ButtonHTMLAttributes } from 'react';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma';

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'bg-primario text-white hover:bg-primario/90',
  secundario: 'border border-borde bg-superficie text-texto hover:bg-primario-suave',
  peligro: 'bg-prioridad-alta text-white hover:bg-prioridad-alta/90',
  fantasma: 'text-primario hover:bg-primario-suave',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  cargando?: boolean;
}

export function claseBoton(variante: VarianteBoton = 'primario'): string {
  return `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]}`;
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
