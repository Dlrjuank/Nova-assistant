'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { colorDeCategoria } from '@/lib/reglas/categorias';
import { DIAS_CORTOS, nombreDia } from '@/lib/reglas/semana';
import { CasillaTarea, type TareaCasilla } from './CasillaTarea';

const numeroDia = (fecha: string) => Number(fecha.slice(8, 10));

/**
 * E06 (PLAN_AMPLIACION 5.1): lunes a domingo, con flechas de semana y el rango. En computador, 7 columnas;
 * en teléfono, una fila de 7 días para elegir y la lista del día elegido. Las tareas van por fecha límite.
 */
export function MiSemana({
  dias,
  porDia,
  hoy,
  rango,
  categorias,
  anterior,
  siguiente,
  actual,
}: {
  dias: string[];
  porDia: Record<string, TareaCasilla[]>;
  hoy: string;
  rango: string;
  categorias: ReadonlyArray<{ nombre: string; color: string }>;
  anterior: string;
  siguiente: string;
  /** Enlace a la semana actual, solo si se está viendo otra. */
  actual: string | null;
}) {
  const [elegido, setElegido] = useState(() => (dias.includes(hoy) ? hoy : (dias[0] as string)));
  const color = (t: TareaCasilla) => colorDeCategoria(t.categoria, categorias);
  const lista = (fecha: string, prefijo: string, compacta: boolean) => {
    const tareas = porDia[fecha] ?? [];
    return tareas.length === 0 ? (
      <p className="px-2 py-1 text-xs text-texto-suave">Sin tareas</p>
    ) : (
      <ul className="flex flex-col gap-1">
        {tareas.map((t) => (
          <li key={t.id}>
            <CasillaTarea tarea={t} color={color(t)} prefijo={prefijo} compacta={compacta} />
          </li>
        ))}
      </ul>
    );
  };
  const flecha = `inline-flex size-9 items-center justify-center rounded-full border border-borde bg-superficie text-texto hover:bg-superficie-2 ${CLASE_FOCO}`;

  return (
    <section aria-labelledby="titulo-semana" className="flex flex-col gap-4 rounded-2xl border border-borde bg-superficie p-4 shadow-suave sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="titulo-semana" className="text-lg font-semibold text-texto">
            Mi semana
          </h2>
          <p className="text-sm text-texto-suave">{rango}</p>
        </div>
        <div className="flex items-center gap-2">
          {actual && (
            <Link href={actual} className={`rounded-full px-3 py-1.5 text-sm font-medium text-acento hover:bg-acento-suave ${CLASE_FOCO}`}>
              Esta semana
            </Link>
          )}
          <Link href={anterior} aria-label="Semana anterior" className={flecha}>
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Link>
          <Link href={siguiente} aria-label="Semana siguiente" className={flecha}>
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>

      {/* Computador: 7 columnas. */}
      <ol className="hidden gap-2 lg:grid lg:grid-cols-7">
        {dias.map((fecha, i) => {
          const esHoy = fecha === hoy;
          return (
            <li key={fecha} aria-label={nombreDia(fecha)} className={`flex min-w-0 flex-col gap-2 rounded-xl p-2 ${esHoy ? 'bg-acento-suave' : 'bg-superficie-2'}`}>
              <p className={`text-center text-xs font-semibold uppercase ${esHoy ? 'text-acento' : 'text-texto-suave'}`} aria-hidden="true">
                {DIAS_CORTOS[i]} <span className="block text-lg normal-case">{numeroDia(fecha)}</span>
              </p>
              {lista(fecha, 'columna', true)}
            </li>
          );
        })}
      </ol>

      {/* Teléfono: fila de 7 días para elegir y la lista del día elegido. */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div role="group" aria-label="Elegir día" className="grid grid-cols-7 gap-1">
          {dias.map((fecha, i) => {
            const activo = fecha === elegido;
            const cantidad = porDia[fecha]?.length ?? 0;
            return (
              <button
                key={fecha}
                type="button"
                aria-pressed={activo}
                aria-label={`${nombreDia(fecha)}${cantidad ? `, ${cantidad === 1 ? '1 tarea' : `${cantidad} tareas`}` : ', sin tareas'}`}
                onClick={() => setElegido(fecha)}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium transition-colors duration-150 ${CLASE_FOCO} ${
                  activo ? 'bg-acento text-acento-texto' : fecha === hoy ? 'bg-acento-suave text-acento' : 'text-texto-suave hover:bg-superficie-2'
                }`}
              >
                <span aria-hidden="true">{DIAS_CORTOS[i]}</span>
                <span aria-hidden="true" className="text-base font-semibold">
                  {numeroDia(fecha)}
                </span>
                <span aria-hidden="true" className={`size-1.5 rounded-full ${cantidad ? (activo ? 'bg-acento-texto' : 'bg-acento') : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
        <div>
          <h3 className="mb-1 px-2 text-sm font-semibold text-texto first-letter:uppercase">{nombreDia(elegido)}</h3>
          {lista(elegido, 'dia', false)}
        </div>
      </div>
    </section>
  );
}
