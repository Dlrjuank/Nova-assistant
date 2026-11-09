'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { claseBoton, CLASE_FOCO } from '@/components/ui/Boton';
import { hrefEditarTarea } from '@/lib/rutasTareas';

/**
 * E09: enlace a editar una tarea pendiente. La pantalla de origen se lee al tocarlo (`volver` la fija cuando
 * la dirección no basta, como el día elegido del Calendario), para que "Guardar cambios" y "Cancelar" vuelvan
 * ahí. Abrirlo en otra pestaña usa el enlace normal, que vuelve a Tareas.
 */
export function EnlaceEditarTarea({
  id,
  titulo,
  volver,
  soloIcono = false,
  className = '',
}: {
  id: string;
  titulo: string;
  volver?: string | undefined;
  soloIcono?: boolean;
  className?: string;
}) {
  const router = useRouter();

  function abrir(evento: MouseEvent<HTMLAnchorElement>) {
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
    evento.preventDefault();
    router.push(hrefEditarTarea(id, volver ?? `${window.location.pathname}${window.location.search}`));
  }

  const clase = soloIcono
    ? `inline-flex shrink-0 items-center justify-center rounded-lg text-texto-suave transition-colors duration-150 hover:bg-superficie-2 hover:text-texto ${CLASE_FOCO}`
    : `${claseBoton('fantasma')} text-texto`; // no es una acción peligrosa: no comparte color con "Eliminar"

  return (
    <Link href={hrefEditarTarea(id)} onClick={abrir} aria-label={`Editar tarea: ${titulo}`} title="Editar" className={`${clase} ${className}`}>
      {soloIcono ? <Pencil aria-hidden="true" className="size-4" /> : 'Editar'}
    </Link>
  );
}
