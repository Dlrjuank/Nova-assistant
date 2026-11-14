'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { claseBoton, CLASE_FOCO } from '@/components/ui/Boton';
import { colorDeCategoria } from '@/lib/reglas/categorias';
import { textoVencidas } from '@/lib/reglas/semana';
import { CasillaTarea, type TareaCasilla } from './CasillaTarea';
import { usePendientesDelDia } from '@/components/nova/pendientes/ProveedorPendientes';
import { TareaPendienteFila } from '@/components/nova/pendientes/TareaPendienteFila';

/**
 * E06 (PLAN_AMPLIACION 5.1): pendientes con fecha límite hoy (ya ordenadas: Alta primero y luego por título),
 * las vencidas con enlace a Tareas y "Agregar" con la fecha de hoy. E11e: también las de hoy creadas sin conexión.
 */
export function PrioridadesHoy({
  tareas,
  hoy,
  vencidas,
  categorias,
}: {
  tareas: TareaCasilla[];
  hoy: string;
  vencidas: number;
  categorias: ReadonlyArray<{ nombre: string; color: string }>;
}) {
  const sinEnviar = usePendientesDelDia(hoy);
  return (
    <section aria-labelledby="titulo-prioridades" className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-suave sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-prioridades" className="text-lg font-semibold text-texto">
          Prioridades de hoy
        </h2>
        <Link href={`/nova/tareas/nueva?fecha=${hoy}`} className={`${claseBoton('secundario')} min-h-9 py-1.5`}>
          <Plus aria-hidden="true" className="size-4" />
          Agregar
        </Link>
      </div>
      {tareas.length === 0 && sinEnviar.length === 0 ? (
        <p className="text-sm text-texto-suave">No tienes tareas pendientes para hoy.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tareas.map((t) => (
            <li key={t.id}>
              <CasillaTarea tarea={t} color={colorDeCategoria(t.categoria, categorias)} prefijo="hoy" />
            </li>
          ))}
          {sinEnviar.map((t) => (
            <li key={t.idCliente}>
              <TareaPendienteFila tarea={t} categorias={categorias} />
            </li>
          ))}
        </ul>
      )}
      {vencidas > 0 && (
        <Link href="/nova/tareas?vista=vencidas" className={`self-start rounded text-sm font-medium text-peligro underline-offset-2 hover:underline ${CLASE_FOCO}`}>
          {textoVencidas(vencidas)}
        </Link>
      )}
    </section>
  );
}
