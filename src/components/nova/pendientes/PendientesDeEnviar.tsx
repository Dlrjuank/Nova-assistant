'use client';

import { textoPendientesDeEnviar } from '@/lib/reglas/tareasPendientes';
import { usePendientes } from './ProveedorPendientes';
import { TareaPendienteFila } from './TareaPendienteFila';

/**
 * E11e (RB-71): arriba de Tareas, mientras haya, `{n} tareas pendientes de enviar` y cada una con su categoría,
 * fecha e insignia. No aparece si no hay ninguna.
 */
export function PendientesDeEnviar({ categorias = [] }: { categorias?: ReadonlyArray<{ nombre: string; color: string }> }) {
  const { lista } = usePendientes();
  if (lista.length === 0) return null;
  return (
    <section aria-labelledby="titulo-pendientes-envio" data-testid="pendientes-de-enviar" className="flex flex-col gap-2">
      <h2 id="titulo-pendientes-envio" className="text-base font-semibold text-texto">
        {textoPendientesDeEnviar(lista.length)}
      </h2>
      <ul className="flex flex-col gap-2">
        {lista.map((t) => (
          <li key={t.idCliente}>
            <TareaPendienteFila tarea={t} categorias={categorias} conFecha />
          </li>
        ))}
      </ul>
    </section>
  );
}
