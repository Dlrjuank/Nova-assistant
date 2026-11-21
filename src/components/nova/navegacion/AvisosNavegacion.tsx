'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DatosAvisos } from '@/lib/reglas/avisos';

const Contexto = createContext<DatosAvisos | null>(null);

/** Lo que muestra la navegación además de las secciones (nombre, vencidas y próximo corte); null mientras no llega. */
export function useAvisosNavegacion(): DatosAvisos | null {
  return useContext(Contexto);
}

/**
 * E20b (commit 1): pide los avisos al abrir Nova y, un segundo después de cada cambio de pantalla, los vuelve a
 * pedir (al completar o crear una tarea cambian las vencidas). Sin conexión no pide nada y deja los que tenía; si
 * el pedido falla, la navegación sigue igual, solo sin el globo ni la tarjeta de aviso.
 */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const [avisos, setAvisos] = useState<DatosAvisos | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    let cancelado = false;
    const temporizador = window.setTimeout(() => {
      fetch('/api/nova/avisos', { cache: 'no-store' })
        .then((r) => (r.ok ? (r.json() as Promise<{ ok: boolean; datos?: DatosAvisos }>) : null))
        .then((cuerpo) => {
          if (!cancelado && cuerpo?.ok && cuerpo.datos) setAvisos(cuerpo.datos);
        })
        .catch(() => undefined);
    }, avisos === null ? 0 : 1000);
    return () => {
      cancelado = true;
      window.clearTimeout(temporizador);
    };
    // Solo al cambiar de pantalla; `avisos` decide la espera, no dispara otro pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta]);

  return <Contexto.Provider value={avisos}>{children}</Contexto.Provider>;
}
