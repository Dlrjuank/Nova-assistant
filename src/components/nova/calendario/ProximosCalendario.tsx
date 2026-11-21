import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { Insignia } from '@/components/ui/Insignia';
import { PuntoCategoria } from '@/components/nova/InsigniaCategoria';
import { cuandoEs } from '@/lib/reglas/avisos';
import { DIAS_PROXIMOS, ETIQUETA_PROXIMO, mesDe, type Proximo } from '@/lib/reglas/calendario';
import { colorDeCategoria } from '@/lib/reglas/categorias';

const MES_CORTO = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', month: 'short' });

/**
 * E20b (commit 4, presentación): "Próximos" del Calendario. Cada fila dice si es una tarea, un corte o una nota,
 * cuándo es ("Hoy", "Mañana", "El viernes 27") y lleva a su lugar: la tarea, a su día en el Calendario; lo de
 * Semestre, a la materia. Se puede abrir sin conexión con la copia del Calendario.
 */
export function ProximosCalendario({
  proximos,
  hoy,
  categorias,
}: {
  proximos: Proximo[];
  hoy: string;
  categorias: ReadonlyArray<{ nombre: string; color: string }>;
}) {
  return (
    <section aria-labelledby="titulo-proximos" className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-suave sm:p-5">
      <h2 id="titulo-proximos" className="font-mono text-xs font-semibold tracking-[0.14em] text-texto-suave uppercase">
        Próximos
      </h2>
      {proximos.length === 0 ? (
        <p className="text-sm text-texto-suave">Nada en los próximos {DIAS_PROXIMOS} días.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {proximos.map((p) => {
            const deSemestre = p.tipo !== 'tarea';
            const href = deSemestre ? `/nova/semestre/${p.materiaId}` : `/nova/calendario?mes=${mesDe(p.fecha)}&dia=${p.fecha}`;
            const fecha = new Date(`${p.fecha}T00:00:00Z`);
            return (
              <li key={`${p.tipo}-${p.id}`}>
                <Link
                  href={href}
                  prefetch={false}
                  data-proximo={p.tipo}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-superficie-2 ${CLASE_FOCO}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex w-11 shrink-0 flex-col items-center rounded-lg py-1 leading-none ${deSemestre ? 'border border-acento text-acento' : 'bg-superficie-2 text-texto'}`}
                  >
                    <span className="font-display text-base font-semibold tabular-nums">{fecha.getUTCDate()}</span>
                    <span className="text-[0.65rem] uppercase">{MES_CORTO.format(fecha).replace('.', '')}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-texto">
                      {deSemestre ? (
                        <GraduationCap aria-hidden="true" className="size-3.5 shrink-0 text-acento" />
                      ) : (
                        <PuntoCategoria color={colorDeCategoria(p.categoria ?? '', categorias)} className="size-2" />
                      )}
                      <span className="truncate">{p.titulo}</span>
                    </span>
                    <span className="text-xs text-texto-suave">{cuandoEs(p.fecha, hoy)}</span>
                  </span>
                  <Insignia tono={deSemestre ? 'acento' : 'neutro'}>{ETIQUETA_PROXIMO[p.tipo]}</Insignia>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
