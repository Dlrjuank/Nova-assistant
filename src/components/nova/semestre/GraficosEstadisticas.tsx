import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { Estadisticas, MateriaEstadistica } from '@/lib/reglas/estadisticas';
import { textoEnRiesgo } from '@/lib/reglas/estadisticas';
import { formatearDecimas } from '@/lib/reglas/notas';
import { formatearPorcentaje } from '@/lib/reglas/preferencias';
import { InsigniaEstadoMateria } from './estadoMateria';

/**
 * E20 (5.7, B-40): los gráficos de Estadísticas. Una sola serie por gráfico (el color de acento de Nova), con la
 * nota para aprobar como línea de referencia; cada gráfico tiene título, descripción, el valor de cada marca al pasar
 * el mouse (o con el lector de pantalla) y su tabla equivalente. Sin animaciones.
 */

const nota = (d: number | null) => (d === null ? 'Sin notas' : formatearDecimas(d));

/** La tabla equivalente, plegada; sigue disponible sin conexión (solo muestra). */
function TablaEquivalente({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details data-sin-conexion="permitido" className="text-sm">
      <summary className={`inline-flex min-h-9 cursor-pointer items-center rounded font-medium text-acento ${CLASE_FOCO}`}>Ver los datos en una tabla</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{titulo}</caption>
          {children}
        </table>
      </div>
    </details>
  );
}

const TH = 'border-b border-borde px-2 py-1.5 font-semibold text-texto';
const TD = 'border-b border-borde px-2 py-1.5 text-texto tabular-nums';

/** Tarjetas de arriba: promedio, materias con notas y materias en riesgo. */
export function ResumenEstadisticas({ datos }: { datos: Estadisticas }) {
  const conNotas = datos.materias.filter((m) => m.actual !== null).length;
  const tarjetas = [
    { titulo: 'Promedio del semestre', valor: nota(datos.promedio), nota: 'Ponderado por créditos' },
    { titulo: 'Materias con notas', valor: `${conNotas} de ${datos.materias.length}`, nota: 'Las demás aún no tienen notas' },
    { titulo: 'En riesgo', valor: String(datos.enRiesgo.length), nota: textoEnRiesgo(datos.enRiesgo.length) },
  ];
  return (
    <ul aria-label="Resumen" className="grid max-w-4xl gap-3 sm:grid-cols-3">
      {tarjetas.map((t) => (
        <li key={t.titulo}>
          <Tarjeta className="flex h-full flex-col gap-1">
            <p className="text-sm text-texto-suave">{t.titulo}</p>
            <p className="text-3xl font-semibold text-texto tabular-nums">{t.valor}</p>
            <p className="text-xs text-texto-suave">{t.nota}</p>
          </Tarjeta>
        </li>
      ))}
    </ul>
  );
}

/** Comparación entre materias: una barra horizontal por materia (0 a 5,0) con la marca de la nota para aprobar. */
export function ComparacionMaterias({ datos }: { datos: Estadisticas }) {
  const titulo = 'Comparación entre materias';
  const marca = `${(datos.aprobar / 50) * 100}%`;
  return (
    <Tarjeta className="flex max-w-4xl flex-col gap-3">
      <figure aria-labelledby="titulo-comparacion" className="flex flex-col gap-3">
        <figcaption className="flex flex-col gap-1">
          <h2 id="titulo-comparacion" className="text-lg font-semibold text-texto">
            {titulo}
          </h2>
          <p className="text-sm text-texto-suave">Nota actual de cada materia, de 0 a 5,0. La línea marca la nota para aprobar ({formatearDecimas(datos.aprobar)}).</p>
        </figcaption>
        <ul className="flex flex-col gap-3">
          {datos.materias.map((m) => (
            <li key={m.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 break-words text-texto">{m.nombre}</span>
                <span className={m.actual === null ? 'shrink-0 text-texto-suave' : 'shrink-0 font-semibold text-texto tabular-nums'}>{nota(m.actual)}</span>
              </div>
              <div
                role="img"
                aria-label={`${m.nombre}: ${m.actual === null ? 'sin notas' : formatearDecimas(m.actual)}`}
                title={`${m.nombre}: ${nota(m.actual)}`}
                className="relative h-3 rounded-full bg-superficie-2"
              >
                {m.actual !== null && <div className="h-3 rounded-full bg-acento" style={{ width: `${Math.max((m.actual / 50) * 100, 2)}%` }} />}
                <div aria-hidden="true" className="absolute -top-1 -bottom-1 w-0.5 rounded bg-texto-suave" style={{ left: marca }} />
              </div>
            </li>
          ))}
        </ul>
      </figure>
      <TablaEquivalente titulo={titulo}>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Materia
            </th>
            <th scope="col" className={TH}>
              Nota actual
            </th>
            <th scope="col" className={TH}>
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {datos.materias.map((m) => (
            <tr key={m.id}>
              <th scope="row" className={`${TD} font-normal`}>
                {m.nombre}
              </th>
              <td className={TD}>{nota(m.actual)}</td>
              <td className={TD}>{m.estado ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </TablaEquivalente>
    </Tarjeta>
  );
}

const W = 320;
const H = 170;
const IZQ = 30;
const DER = 12;
const ARRIBA = 20;
const ABAJO = 30;
const y = (decimas: number) => ARRIBA + (1 - decimas / 50) * (H - ARRIBA - ABAJO);
const corto = (t: string) => (t.length > 12 ? `${t.slice(0, 11)}…` : t);

/** La evolución de una materia por corte: una línea de 2 px con un punto por corte calificado y su valor. */
function EvolucionMateria({ materia, aprobar }: { materia: MateriaEstadistica; aprobar: number }) {
  const n = materia.cortes.length;
  const ancho = (W - IZQ - DER) / Math.max(n, 1);
  const x = (i: number) => IZQ + (i + 0.5) * ancho;
  // Tramos entre cortes seguidos con nota: un corte sin notas deja un hueco, no un 0.
  const tramos: string[] = [];
  materia.cortes.forEach((c, i) => {
    const previo = materia.cortes[i - 1];
    if (c.nota !== null && previo && previo.nota !== null) tramos.push(`M${x(i - 1)} ${y(previo.nota)} L${x(i)} ${y(c.nota)}`);
  });
  const idTitulo = `evolucion-${materia.id}`;
  const descripcion = materia.cortes.map((c) => `${c.nombre}: ${nota(c.nota)}`).join(', ');
  return (
    <figure className="flex flex-col gap-2 rounded-xl border border-borde p-3">
      <figcaption id={idTitulo} className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 font-semibold break-words text-texto">{materia.nombre}</span>
        <span className="shrink-0 text-sm text-texto-suave">Actual {nota(materia.actual)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-md" role="img" aria-labelledby={idTitulo} aria-describedby={`${idTitulo}-desc`}>
        <desc id={`${idTitulo}-desc`}>{`Nota por corte: ${descripcion}. Nota para aprobar ${formatearDecimas(aprobar)}.`}</desc>
        {[0, 50].map((v) => (
          <g key={v}>
            <line x1={IZQ} x2={W - DER} y1={y(v)} y2={y(v)} className="stroke-borde" strokeWidth={1} />
            <text x={IZQ - 6} y={y(v) + 4} textAnchor="end" fontSize={11} className="fill-texto-suave">
              {formatearDecimas(v)}
            </text>
          </g>
        ))}
        <line x1={IZQ} x2={W - DER} y1={y(aprobar)} y2={y(aprobar)} className="stroke-texto-suave" strokeWidth={1} strokeDasharray="4 4" />
        <text x={IZQ - 6} y={y(aprobar) + 4} textAnchor="end" fontSize={11} className="fill-texto-suave">
          {formatearDecimas(aprobar)}
        </text>
        {tramos.map((d) => (
          <path key={d} d={d} className="stroke-acento" strokeWidth={2} fill="none" strokeLinecap="round" />
        ))}
        {materia.cortes.map((c, i) => (
          <g key={c.nombre}>
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize={11} className="fill-texto-suave">
              {corto(c.nombre)}
            </text>
            {c.nota === null ? (
              <text x={x(i)} y={y(12)} textAnchor="middle" fontSize={11} className="fill-texto-suave">
                Sin notas
              </text>
            ) : (
              <g>
                <title>{`${c.nombre} (${formatearPorcentaje(c.porcentaje)} %): ${formatearDecimas(c.nota)}`}</title>
                {/* Zona de toque más grande que el punto, para el título al pasar el mouse. */}
                <circle cx={x(i)} cy={y(c.nota)} r={14} fill="transparent" />
                <circle cx={x(i)} cy={y(c.nota)} r={5} className="fill-acento stroke-superficie" strokeWidth={2} />
                <text x={x(i)} y={y(c.nota) - 10} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-texto">
                  {formatearDecimas(c.nota)}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** Evolución por corte: un gráfico pequeño por materia con cortes; las materias sin cortes, su nota actual. */
export function EvolucionPorCorte({ datos }: { datos: Estadisticas }) {
  const titulo = 'Evolución por corte';
  const conCortes = datos.materias.filter((m) => m.usaCortes && m.cortes.length > 0);
  const sinCortes = datos.materias.filter((m) => !m.usaCortes || m.cortes.length === 0);
  return (
    <Tarjeta className="flex max-w-4xl flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
        <p className="text-sm text-texto-suave">La nota de cada corte, de 0 a 5,0. La línea punteada es la nota para aprobar; un corte sin notas queda vacío.</p>
      </div>
      {conCortes.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {conCortes.map((m) => (
            <EvolucionMateria key={m.id} materia={m} aprobar={datos.aprobar} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-texto-suave">Ninguna materia está dividida en cortes.</p>
      )}
      {sinCortes.length > 0 && (
        <ul aria-label="Materias sin cortes" className="flex flex-col gap-1 text-sm">
          {sinCortes.map((m) => (
            <li key={m.id} className="text-texto">
              {m.nombre} <span className="text-texto-suave">(sin cortes): nota actual {nota(m.actual)}</span>
            </li>
          ))}
        </ul>
      )}
      {conCortes.length > 0 && (
        <TablaEquivalente titulo={titulo}>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Materia
              </th>
              <th scope="col" className={TH}>
                Corte
              </th>
              <th scope="col" className={TH}>
                Peso
              </th>
              <th scope="col" className={TH}>
                Nota
              </th>
            </tr>
          </thead>
          <tbody>
            {conCortes.flatMap((m) =>
              m.cortes.map((c) => (
                <tr key={`${m.id}-${c.nombre}`}>
                  <th scope="row" className={`${TD} font-normal`}>
                    {m.nombre}
                  </th>
                  <td className={TD}>{c.nombre}</td>
                  <td className={TD}>{formatearPorcentaje(c.porcentaje)} %</td>
                  <td className={TD}>{nota(c.nota)}</td>
                </tr>
              )),
            )}
          </tbody>
        </TablaEquivalente>
      )}
    </Tarjeta>
  );
}

/** Materias en riesgo, por nota o por fallas (7.4, 7.7), de la más grave a la menos grave. */
export function MateriasEnRiesgo({ datos }: { datos: Estadisticas }) {
  return (
    <Tarjeta className="flex max-w-4xl flex-col gap-3">
      <h2 className="text-lg font-semibold text-texto">Materias en riesgo</h2>
      {datos.enRiesgo.length === 0 ? (
        <p className="text-sm text-texto-suave">Ninguna materia está en riesgo por nota ni por fallas.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde rounded-xl border border-borde">
          {datos.enRiesgo.map((m) => (
            <li key={m.id}>
              <Link href={`/nova/semestre/${m.id}`} prefetch={false} className={`flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-superficie-2 ${CLASE_FOCO}`}>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold break-words text-texto">{m.nombre}</span>
                    {m.estado && <InsigniaEstadoMateria estado={m.estado} />}
                  </span>
                  {m.riesgo.map((r) => (
                    <span key={r.motivo} className="text-sm text-texto-suave">
                      {r.texto}
                    </span>
                  ))}
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-texto-suave" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}
