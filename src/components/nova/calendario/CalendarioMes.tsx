'use client';

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { claseBoton, CLASE_FOCO } from '@/components/ui/Boton';
import { PuntoCategoria } from '@/components/nova/InsigniaCategoria';
import { CasillaTarea, type TareaCasilla } from '@/components/nova/inicio/CasillaTarea';
import { estaVencida, mesDe } from '@/lib/reglas/calendario';
import { colorDeCategoria } from '@/lib/reglas/categorias';
import { useFormatoHora } from '@/components/nova/PreferenciasNova';
import { formatearHorario } from '@/lib/reglas/horario';
import { DIAS_CORTOS, nombreDia } from '@/lib/reglas/semana';

export type TareaCalendario = TareaCasilla & { fechaLimite: string };

/** Puntos por día en el teléfono y títulos por día en el computador, antes de "+N". */
const MAX_PUNTOS = 3;
const MAX_TITULOS = 2;

/**
 * E07 (PLAN_AMPLIACION 5.3): vista mensual (lunes primero) con flechas de mes y "Hoy". Cada día muestra
 * puntos del color de la categoría de sus tareas y, desde 1280 px, el título corto con su hora. Al elegir un
 * día se ve su lista (ya ordenada: pendientes con hora, luego sin hora, completadas al final) y "Agregar"
 * con esa fecha. Las pendientes vencidas llevan una marca sutil.
 */
export function CalendarioMes({
  mes,
  titulo,
  hoy,
  semanas,
  porDia,
  categorias,
  anterior,
  siguiente,
  diaInicial,
}: {
  mes: string;
  titulo: string;
  hoy: string;
  semanas: string[][];
  porDia: Record<string, TareaCalendario[]>;
  categorias: ReadonlyArray<{ nombre: string; color: string }>;
  anterior: string;
  siguiente: string;
  /** E09: `?dia=` al volver de editar una tarea; solo si está en la cuadrícula. */
  diaInicial?: string | undefined;
}) {
  const formatoHora = useFormatoHora(); // E11: 24 o 12 horas
  const [elegido, setElegido] = useState(() => (diaInicial && semanas.flat().includes(diaInicial) ? diaInicial : mesDe(hoy) === mes ? hoy : `${mes}-01`));
  const color = (t: TareaCalendario) => colorDeCategoria(t.categoria, categorias);
  const tareasDia = porDia[elegido] ?? [];
  const esMesActual = mesDe(hoy) === mes;
  const panelDia = useRef<HTMLElement>(null);
  // Cada toque en un día pide llevar su lista a la vista. Se hace en un efecto, ya con la lista nueva dibujada:
  // medirla antes daba el alto de la lista anterior y la página se quedaba corta.
  const [pedido, setPedido] = useState(0);

  const elegir = (fecha: string) => {
    setElegido(fecha);
    setPedido((n) => n + 1);
  };

  useEffect(() => {
    const panel = panelDia.current;
    if (pedido === 0 || !panel || typeof panel.scrollIntoView !== 'function') return;
    const { top, bottom } = panel.getBoundingClientRect();
    if (top >= 0 && bottom <= window.innerHeight) return; // ya se ve entera: no se mueve
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const computador = window.matchMedia?.('(min-width: 1024px)').matches ?? false;
    // Computador: la lista queda arriba de la pantalla (se ve completa o lo más posible).
    // Teléfono: baja solo lo necesario, para no esconder el mes en cada toque.
    panel.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: computador ? 'start' : 'nearest' });
  }, [pedido]);

  // Leyenda: solo las categorías que tienen tareas en este mes.
  const usadas = new Map<string, string>();
  for (const [fecha, tareas] of Object.entries(porDia)) {
    if (mesDe(fecha) !== mes) continue;
    for (const t of tareas) {
      const nombre = categorias.find((c) => c.nombre.toLowerCase() === t.categoria.trim().toLowerCase())?.nombre ?? t.categoria;
      usadas.set(nombre, color(t));
    }
  }

  const flecha = `inline-flex size-10 items-center justify-center rounded-full border border-borde bg-superficie text-texto hover:bg-superficie-2 ${CLASE_FOCO}`;

  // La lista del día va al lado solo desde 1536 px: antes, al lado dejaría las celdas tan angostas que los títulos no se leen.
  return (
    <div className="flex flex-col gap-4 2xl:grid 2xl:grid-cols-[1fr_22rem] 2xl:items-start">
      <section aria-labelledby="titulo-mes" className="flex flex-col gap-4 rounded-2xl border border-borde bg-superficie p-3 shadow-suave sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-mes" className="text-lg font-semibold text-texto first-letter:uppercase">
            {titulo}
          </h2>
          <div className="flex items-center gap-2">
            {esMesActual ? (
              <button type="button" data-sin-conexion="permitido" onClick={() => elegir(hoy)} className={`${claseBoton('secundario')} min-h-10`}>
                Hoy
              </button>
            ) : (
              <Link href="/nova/calendario" className={`${claseBoton('secundario')} min-h-10`}>
                Hoy
              </Link>
            )}
            <Link href={anterior} aria-label="Mes anterior" className={flecha}>
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Link>
            <Link href={siguiente} aria-label="Mes siguiente" className={flecha}>
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>

        <div role="grid" aria-labelledby="titulo-mes" className="flex flex-col gap-1">
          <div role="row" className="grid grid-cols-7 gap-1">
            {DIAS_CORTOS.map((d) => (
              <span key={d} role="columnheader" className="py-1 text-center text-xs font-semibold uppercase text-texto-suave">
                {d}
              </span>
            ))}
          </div>
          {semanas.map((semana) => (
            <div key={semana[0]} role="row" className="grid grid-cols-7 gap-1">
              {semana.map((fecha) => {
                const tareas = porDia[fecha] ?? [];
                const delMes = mesDe(fecha) === mes;
                const esHoy = fecha === hoy;
                const activo = fecha === elegido;
                const pendientes = tareas.filter((t) => t.estado !== 'Completada').length;
                return (
                  <div key={fecha} role="gridcell" aria-selected={activo}>
                    <button
                      type="button"
                      data-sin-conexion="permitido" // E11b: elegir un día solo muestra, se puede sin conexión
                      onClick={() => elegir(fecha)}
                      aria-pressed={activo}
                      aria-label={`${nombreDia(fecha)}${esHoy ? ', hoy' : ''}, ${
                        tareas.length === 0 ? 'sin tareas' : tareas.length === 1 ? '1 tarea' : `${tareas.length} tareas`
                      }${tareas.length && pendientes !== tareas.length ? ` (${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'})` : ''}`}
                      className={`flex h-full min-h-14 w-full flex-col items-stretch gap-1 rounded-xl border p-1 text-left transition-colors duration-150 sm:min-h-20 sm:p-1.5 xl:min-h-24 ${CLASE_FOCO} ${
                        activo ? 'border-acento bg-acento-suave' : 'border-transparent hover:bg-superficie-2'
                      } ${delMes ? '' : 'opacity-60'}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-7 items-center justify-center self-center rounded-full text-sm font-semibold sm:self-start ${
                          esHoy ? 'bg-acento text-acento-texto' : delMes ? 'text-texto' : 'text-texto-suave'
                        }`}
                      >
                        {Number(fecha.slice(8, 10))}
                      </span>
                      {/* Teléfono y tableta: puntos de color. */}
                      {tareas.length > 0 && (
                        <span aria-hidden="true" className="flex flex-wrap items-center justify-center gap-0.5 sm:justify-start xl:hidden">
                          {tareas.slice(0, MAX_PUNTOS).map((t) => (
                            <PuntoCategoria key={t.id} color={color(t)} className={t.estado === 'Completada' ? 'opacity-40' : ''} />
                          ))}
                          {tareas.length > MAX_PUNTOS && <span className="text-xs leading-none font-semibold text-texto-suave">+{tareas.length - MAX_PUNTOS}</span>}
                        </span>
                      )}
                      {/* Computador ancho: títulos cortos con su hora. */}
                      {tareas.length > 0 && (
                        <span aria-hidden="true" className="hidden min-w-0 flex-col gap-0.5 xl:flex">
                          {tareas.slice(0, MAX_TITULOS).map((t) => (
                            <span
                              key={t.id}
                              className={`flex min-w-0 items-center gap-1 text-xs ${
                                t.estado === 'Completada' ? 'text-texto-suave line-through' : estaVencida(t, hoy) ? 'text-peligro' : 'text-texto'
                              }`}
                            >
                              <PuntoCategoria color={color(t)} className="size-2" />
                              <span className="truncate">
                                {t.horaInicio ? `${formatearHorario({ horaInicio: t.horaInicio }, formatoHora)} ` : ''}
                                {t.titulo}
                              </span>
                            </span>
                          ))}
                          {tareas.length > MAX_TITULOS && <span className="text-xs font-semibold text-texto-suave">+{tareas.length - MAX_TITULOS} más</span>}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {usadas.size > 0 && (
          <ul aria-label="Categorías de este mes" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-borde pt-3">
            {[...usadas].map(([nombre, c]) => (
              <li key={nombre} className="flex items-center gap-1.5 text-xs text-texto-suave">
                <PuntoCategoria color={c} />
                {nombre}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section ref={panelDia} aria-labelledby="titulo-dia" className="scroll-mt-4 flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-suave sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-dia" className="text-base font-semibold text-texto first-letter:uppercase">
            {nombreDia(elegido)}
            {elegido === hoy && <span className="ml-2 text-sm font-medium text-acento">Hoy</span>}
          </h2>
          <Link href={`/nova/tareas/nueva?fecha=${elegido}`} className={`${claseBoton('secundario')} min-h-9 shrink-0 py-1.5`}>
            <Plus aria-hidden="true" className="size-4" />
            Agregar
          </Link>
        </div>
        {tareasDia.length === 0 ? (
          <p className="text-sm text-texto-suave">Sin tareas este día.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tareasDia.map((t) => (
              <li key={t.id}>
                <CasillaTarea tarea={t} color={color(t)} prefijo="calendario" vencida={estaVencida(t, hoy)} volver={`/nova/calendario?mes=${mes}&dia=${elegido}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
