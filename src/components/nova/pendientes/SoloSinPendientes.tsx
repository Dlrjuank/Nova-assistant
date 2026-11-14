'use client';

import type { ReactNode } from 'react';
import { usePendientes } from './ProveedorPendientes';

/** E11e: muestra su contenido (por ejemplo, "Aún no tienes tareas") solo si no hay tareas pendientes de enviar. */
export function SoloSinPendientes({ children }: { children: ReactNode }) {
  const { lista } = usePendientes();
  return lista.length > 0 ? null : <>{children}</>;
}
