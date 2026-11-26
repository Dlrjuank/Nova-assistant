import type { SelectHTMLAttributes } from 'react';
import { CLASE_CONTROL } from './Campo';

interface Opcion {
  valor: string;
  texto: string;
  /** Opciones seguidas con el mismo grupo van juntas bajo su título (`<optgroup>`). */
  grupo?: string | undefined;
}

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string;
  id: string;
  opciones: Opcion[];
  error?: string | undefined;
}

/** Junta las opciones seguidas que comparten grupo; las que no tienen grupo quedan sueltas. */
function enBloques(opciones: Opcion[]): Array<{ grupo?: string | undefined; opciones: Opcion[] }> {
  const bloques: Array<{ grupo?: string | undefined; opciones: Opcion[] }> = [];
  for (const o of opciones) {
    const ultimo = bloques.at(-1);
    if (ultimo && ultimo.grupo === o.grupo) ultimo.opciones.push(o);
    else bloques.push({ grupo: o.grupo, opciones: [o] });
  }
  return bloques;
}

export function Selector({ etiqueta, id, opciones, error, className = '', ...resto }: Props) {
  const idError = error ? `${id}-error` : undefined;
  const opcion = (o: Opcion) => (
    <option key={o.valor} value={o.valor}>
      {o.texto}
    </option>
  );
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
        className={`${CLASE_CONTROL} ${error ? 'border-peligro' : 'border-borde'} ${className}`}
      >
        {enBloques(opciones).map((b, i) =>
          b.grupo ? (
            <optgroup key={`${b.grupo}-${i}`} label={b.grupo}>
              {b.opciones.map(opcion)}
            </optgroup>
          ) : (
            b.opciones.map(opcion)
          ),
        )}
      </select>
      {error && (
        <p id={idError} className="text-xs font-medium text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
