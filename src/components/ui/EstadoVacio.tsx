import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Pantalla o lista vacía. E20b (commit 3): con `icono`, un círculo suave con el ícono arriba del título, para que
 * el vacío se vea amable y no como un error.
 */
export function EstadoVacio({
  titulo,
  descripcion,
  accion,
  icono: Icono,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  icono?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-borde bg-superficie px-6 py-12 text-center">
      {Icono && (
        <span aria-hidden="true" className="mb-1 flex size-14 items-center justify-center rounded-full bg-acento-suave text-acento ring-8 ring-acento-suave/40">
          <Icono className="size-6" />
        </span>
      )}
      <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
      {descripcion && <p className="max-w-md text-sm text-texto-suave">{descripcion}</p>}
      {accion}
    </div>
  );
}
