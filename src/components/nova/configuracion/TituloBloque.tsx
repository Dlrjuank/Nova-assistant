import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** E20b (commit 9): el título de cada bloque de Configuración, con su ícono en una pastilla de acento. */
export function TituloBloque({ icono: Icono, children, id }: { icono: LucideIcon; children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 font-display text-base font-semibold text-texto">
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-xl bg-acento-suave text-acento">
        <Icono className="size-4" />
      </span>
      {children}
    </h2>
  );
}

/** Las secciones de Configuración, en orden, para el índice de la pantalla ancha. */
export const SECCIONES_CONFIGURACION = [
  { id: 'config-perfil', texto: 'Perfil' },
  { id: 'config-apariencia', texto: 'Apariencia' },
  { id: 'config-academico', texto: 'Académico' },
  { id: 'config-notificaciones', texto: 'Notificaciones' },
  { id: 'config-asistente', texto: 'Asistente' },
  { id: 'config-instalar', texto: 'Instalar Nova' },
  { id: 'config-sesion', texto: 'Sesión' },
] as const;
