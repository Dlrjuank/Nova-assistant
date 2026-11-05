import type { SelectHTMLAttributes } from 'react';
import { CLASE_CONTROL } from './Campo';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string;
  id: string;
  opciones: Array<{ valor: string; texto: string }>;
  error?: string | undefined;
}

export function Selector({ etiqueta, id, opciones, error, className = '', ...resto }: Props) {
  const idError = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        {etiqueta}
      </label>
      <select
        id={id}
        {...resto}
        aria-invalid={error ? true : undefined}
        aria-describedby={idError}
        className={`${CLASE_CONTROL} ${error ? 'border-prioridad-alta' : 'border-borde'} ${className}`}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {error && (
        <p id={idError} className="text-xs font-medium text-prioridad-alta">
          {error}
        </p>
      )}
    </div>
  );
}
