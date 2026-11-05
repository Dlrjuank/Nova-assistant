import type { ReactNode } from 'react';

export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-borde bg-superficie px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
      {descripcion && <p className="max-w-md text-sm text-texto-suave">{descripcion}</p>}
      {accion}
    </div>
  );
}
