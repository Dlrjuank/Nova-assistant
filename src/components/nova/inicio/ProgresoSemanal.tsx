import type { Progreso } from '@/lib/reglas/semana';

const RADIO = 42;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

/**
 * E06 (PLAN_AMPLIACION 5.1 y 7.1): anillo con el porcentaje de tareas completadas de la semana mostrada y
 * los contadores. El anillo es decorativo para lectores de pantalla: el dato va también en texto.
 */
export function ProgresoSemanal({ progreso }: { progreso: Progreso }) {
  const { total, completadas, pendientes, porcentaje } = progreso;
  return (
    <section aria-labelledby="titulo-progreso" className="flex flex-col gap-4 rounded-2xl border border-borde bg-superficie p-4 shadow-suave sm:p-6">
      <h2 id="titulo-progreso" className="text-lg font-semibold text-texto">
        Progreso semanal
      </h2>
      <div className="flex items-center gap-5">
        <div className="relative size-28 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={RADIO} fill="none" strokeWidth="10" className="stroke-superficie-2" />
            <circle
              cx="50"
              cy="50"
              r={RADIO}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={CIRCUNFERENCIA * (1 - porcentaje / 100)}
              className="stroke-acento transition-[stroke-dashoffset] duration-200"
            />
          </svg>
          <p className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-texto">
            {porcentaje} %<span className="sr-only"> de las tareas de la semana completadas</span>
          </p>
        </div>
        <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-texto-suave">Completadas</dt>
          <dd className="font-semibold text-texto">{completadas}</dd>
          <dt className="text-texto-suave">Pendientes</dt>
          <dd className="font-semibold text-texto">{pendientes}</dd>
          <dt className="text-texto-suave">Total</dt>
          <dd className="font-semibold text-texto">{total}</dd>
        </dl>
      </div>
      {total === 0 && <p className="text-sm text-texto-suave">No hay tareas con fecha límite en esta semana.</p>}
    </section>
  );
}
