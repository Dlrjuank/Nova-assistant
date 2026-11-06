import type { ReactNode } from 'react';

/**
 * Encabezado de cada pantalla (PLAN_AMPLIACION 3.2): título, subtítulo opcional y acción principal
 * a la derecha; en el teléfono la acción queda debajo del título.
 */
export function EncabezadoPantalla({
  titulo,
  subtitulo,
  accion,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-texto">{titulo}</h1>
        {subtitulo && <p className="text-sm text-texto-suave">{subtitulo}</p>}
      </div>
      {accion && <div className="flex shrink-0 flex-wrap gap-2">{accion}</div>}
    </header>
  );
}
