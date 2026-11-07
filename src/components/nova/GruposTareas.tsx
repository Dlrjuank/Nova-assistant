import { PuntoCategoria } from '@/components/nova/InsigniaCategoria';
import { TablaTareas } from '@/components/nova/TablaTareas';
import type { Tarea } from '@/lib/dataService';
import { agruparPorCategoria } from '@/lib/reglas/vistasTareas';

/**
 * E08 (PLAN_AMPLIACION 5.4): las tareas de la pestaña agrupadas por categoría. Cada grupo tiene encabezado
 * con su color, su nombre y el contador completadas/total dentro de la pestaña (por ejemplo "1/3").
 */
export function GruposTareas({
  tareas,
  categorias,
  hoy,
}: {
  tareas: Tarea[];
  categorias: ReadonlyArray<{ nombre: string; color: string }>;
  hoy: string;
}) {
  const grupos = agruparPorCategoria(tareas, categorias);
  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g, i) => {
        const id = `grupo-tareas-${i}`;
        return (
          <section key={g.nombre} aria-labelledby={id} className="flex flex-col gap-3">
            <h2 id={id} className="flex min-w-0 items-center gap-2 text-base font-semibold text-texto">
              <PuntoCategoria color={g.color} />
              <span className="truncate" title={g.nombre}>
                {g.nombre}
              </span>
              <span aria-hidden="true" className="shrink-0 rounded-full bg-superficie-2 px-2 py-0.5 text-xs font-semibold tabular-nums text-texto-suave">
                {g.completadas}/{g.total}
              </span>
              <span className="sr-only">
                , {g.completadas} de {g.total} {g.total === 1 ? 'completada' : 'completadas'}
              </span>
            </h2>
            <TablaTareas tareas={g.tareas} categorias={categorias} hoy={hoy} sinCategoria etiqueta={`Tareas de ${g.nombre}`} />
          </section>
        );
      })}
    </div>
  );
}
