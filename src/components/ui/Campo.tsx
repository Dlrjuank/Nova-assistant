import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  id: string;
  error?: string | undefined;
  ayuda?: string | undefined;
}

export const CLASE_CONTROL =
  'min-h-10 w-full rounded-xl border bg-superficie px-3 py-2 text-sm text-texto transition-colors duration-150 placeholder:text-texto-suave focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-acento';

export function Campo({ etiqueta, id, error, ayuda, className = '', ...resto }: Props) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        {etiqueta}
      </label>
      <input
        id={id}
        {...resto}
        aria-invalid={error ? true : undefined}
        aria-describedby={[idAyuda, idError].filter(Boolean).join(' ') || undefined}
        className={`${CLASE_CONTROL} ${error ? 'border-peligro' : 'border-borde'} ${className}`}
      />
      {ayuda && (
        <p id={idAyuda} className="text-xs text-texto-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="text-xs font-medium text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
