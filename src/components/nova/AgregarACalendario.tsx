'use client';

import { CalendarPlus } from 'lucide-react';
import { claseBoton, CLASE_FOCO } from '@/components/ui/Boton';

/** E11d (RB-47): la dirección del .ics de una tarea. */
export const hrefIcs = (id: string) => `/api/nova/tareas/${encodeURIComponent(id)}/ics`;

/**
 * E11d (RB-47): "Agregar a mi calendario". Es un enlace normal al .ics: el iPhone lo abre en una hoja para
 * agregarlo al Calendario y Android o el computador lo descargan para abrirlo con su calendario. `alAgregar`
 * permite mostrar el aviso de que es una copia.
 */
export function AgregarACalendario({
  id,
  titulo,
  soloIcono = false,
  className = '',
  alAgregar,
}: {
  id: string;
  titulo: string;
  soloIcono?: boolean;
  className?: string;
  alAgregar?: () => void;
}) {
  const clase = soloIcono
    ? `inline-flex shrink-0 items-center justify-center rounded-lg text-texto-suave transition-colors duration-150 hover:bg-superficie-2 hover:text-texto ${CLASE_FOCO}`
    : `${claseBoton('fantasma')} text-texto`;
  return (
    <a
      href={hrefIcs(id)}
      onClick={alAgregar}
      aria-label={`Agregar a mi calendario: ${titulo}`}
      title="Agregar a mi calendario"
      className={`${clase} ${className}`}
    >
      <CalendarPlus aria-hidden="true" className="size-4" />
      {!soloIcono && 'Agregar a mi calendario'}
    </a>
  );
}
