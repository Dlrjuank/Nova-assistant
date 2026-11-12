import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { claseBoton } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { CuestionarioHistorial, DocumentoHistorial, IntentoHistorial } from '@/lib/dataService';
import { formatearFecha } from '@/lib/formato';
import { formatearPuntaje, NOMBRE_DIFICULTAD } from '@/lib/reglas/cuestionarios';
import { TEXTO_COMPARACION } from '@/lib/reglas/historialCuestionarios';

const ICONO_COMPARACION = { mejor: TrendingUp, igual: Minus, peor: TrendingDown } as const;
const COLOR_COMPARACION = { mejor: 'text-exito', igual: 'text-texto-suave', peor: 'text-peligro' } as const;

/** Ícono y texto, no solo color. */
function Comparacion({ valor }: { valor: NonNullable<IntentoHistorial['comparacion']> }) {
  const Icono = ICONO_COMPARACION[valor];
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${COLOR_COMPARACION[valor]}`}>
      <Icono aria-hidden="true" className="size-4" />
      {TEXTO_COMPARACION[valor]}
    </span>
  );
}

function FilaIntento({ i }: { i: IntentoHistorial }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
      <span className="flex flex-wrap items-center gap-2 text-sm text-texto">
        {formatearFecha(i.fecha)}
        {i.repaso && <span className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs font-semibold text-texto-suave">Repaso</span>}
      </span>
      <span className="flex flex-wrap items-center gap-3">
        {i.comparacion && <Comparacion valor={i.comparacion} />}
        {i.terminado && i.puntaje !== null ? (
          <span className="text-sm font-semibold text-texto tabular-nums">
            {formatearPuntaje(i.puntaje)} de 5 <span className="font-normal text-texto-suave">({i.aciertos} de {i.total})</span>
          </span>
        ) : (
          <span className="text-sm text-texto-suave">Sin terminar</span>
        )}
      </span>
    </li>
  );
}

function TarjetaCuestionario({ c }: { c: CuestionarioHistorial }) {
  const ultimo = c.intentos[0];
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-texto">{c.alcance}</h3>
          <p className="text-sm text-texto-suave">
            Dificultad {NOMBRE_DIFICULTAD[c.dificultad].toLowerCase()} · {c.preguntas} {c.preguntas === 1 ? 'pregunta' : 'preguntas'} · Creado el {formatearFecha(c.creadoEn)}
          </p>
        </div>
        <Link href={`/nova/cuestionarios/${c.id}`} className={`${claseBoton('secundario')} min-h-10 shrink-0`} aria-label={`Abrir el cuestionario ${c.alcance}`}>
          {ultimo && !ultimo.terminado ? 'Continuar' : 'Abrir'}
        </Link>
      </div>
      {c.intentos.length > 0 && (
        <ol aria-label="Intentos, del más reciente al más antiguo" className="mt-2 flex flex-col divide-y divide-borde">
          {c.intentos.map((i) => (
            <FilaIntento key={i.id} i={i} />
          ))}
        </ol>
      )}
    </Tarjeta>
  );
}

/** E10f (5.11): intentos por documento y por capítulo, con fecha, dificultad, puntaje y si mejoraste. */
export function HistorialCuestionarios({ documentos }: { documentos: readonly DocumentoHistorial[] }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {documentos.map((d) => (
        <section key={d.id} aria-labelledby={`doc-${d.id}`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`doc-${d.id}`} className="min-w-0 break-all text-base font-semibold text-texto">
              {d.nombre}
            </h2>
            <Link href={`/nova/cuestionarios/nuevo?documento=${d.id}`} className={`${claseBoton('fantasma')} min-h-10`}>
              Crear cuestionario
            </Link>
          </div>
          {d.cuestionarios.map((c) => (
            <TarjetaCuestionario key={c.id} c={c} />
          ))}
        </section>
      ))}
    </div>
  );
}
