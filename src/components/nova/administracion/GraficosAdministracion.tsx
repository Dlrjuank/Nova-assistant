'use client';

import { useId, useState } from 'react';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { avisoDeUso, nivelDeUso, type NivelUso } from '@/lib/reglas/cuentas';

/**
 * E20c-2 (5.14, prototipo "Administración"): el medidor circular del espacio con marcas al 80 % y al 95 % y la
 * actividad de 14 días en barras. Solo tokens de Nova; cada gráfico dice su dato con texto y tiene su descripción.
 */

const TRAZO: Record<NivelUso, string> = { normal: 'stroke-acento', aviso: 'stroke-aviso', fuerte: 'stroke-peligro' };
const TEXTO_AVISO: Record<NivelUso, string> = { normal: 'text-texto-suave', aviso: 'text-aviso', fuerte: 'text-peligro' };

export function Medidor({ que, porcentaje, titulo, detalle }: { que: 'base' | 'blob'; porcentaje: number | null; titulo: string; detalle: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const p = porcentaje === null ? 0 : Math.min(100, Math.max(0, porcentaje));
  const nivel = nivelDeUso(p);
  const aviso = porcentaje === null ? '' : avisoDeUso(que, porcentaje);
  return (
    <div className="flex items-center gap-4" data-medidor={que} data-porcentaje={porcentaje ?? ''}>
      <svg viewBox="0 0 96 96" className="size-24 shrink-0" role="img" aria-label={porcentaje === null ? `${titulo}: sin medir` : `${titulo}: ${porcentaje} % del plan gratuito. Avisos al 80 % y al 95 %.`}>
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="10" className="stroke-superficie-2" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`}
          transform="rotate(-90 48 48)"
          className={`transition-[stroke-dasharray] duration-700 ${TRAZO[nivel]}`}
        />
        {[80, 95].map((m) => {
          const a = (m / 100) * 2 * Math.PI - Math.PI / 2;
          return <line key={m} x1={48 + 32 * Math.cos(a)} y1={48 + 32 * Math.sin(a)} x2={48 + 44 * Math.cos(a)} y2={48 + 44 * Math.sin(a)} strokeWidth="1.5" className="stroke-texto-suave" data-marca={m} />;
        })}
        <text x="48" y="54" textAnchor="middle" className="fill-texto font-display text-[18px] font-extrabold">
          {porcentaje === null ? '—' : `${porcentaje} %`}
        </text>
      </svg>
      <div className="flex min-w-0 flex-col gap-0.5 text-sm">
        <p className="font-semibold text-texto">{titulo}</p>
        <p className="text-texto-suave tabular-nums">{detalle}</p>
        <p className="text-xs text-texto-suave">Avisos al 80 % y al 95 %</p>
        {aviso && (
          <p role="status" className={`text-xs font-medium ${TEXTO_AVISO[nivel]}`}>
            {aviso}
          </p>
        )}
      </div>
    </div>
  );
}

export const SERIES_ACTIVIDAD = ['Preguntas', 'Registros', 'Documentos'] as const;
export type SerieActividad = (typeof SERIES_ACTIVIDAD)[number];

const DESCRIPCION_SERIE: Record<SerieActividad, string> = {
  Preguntas: 'preguntas al Asistente',
  Registros: 'cuentas nuevas',
  Documentos: 'PDF subidos',
};

/** "2026-11-25" → "25". */
const diaDelMes = (fecha: string) => String(Number(fecha.slice(8, 10)));

/** B-103: la actividad de 14 días de todas las cuentas juntas (solo conteos), con selector de serie y su tabla. */
export function ActividadCatorceDias({ dias, series }: { dias: string[]; series: Record<SerieActividad, number[]> }) {
  const [serie, setSerie] = useState<SerieActividad>('Preguntas');
  const id = useId();
  const datos = series[serie];
  const W = 560;
  const H = 190;
  const izq = 28;
  const abajo = 26;
  const max = Math.max(...datos, 4);
  const tope = Math.ceil(max / 5) * 5;
  const ancho = (W - izq - 8) / Math.max(1, datos.length);
  const total = datos.reduce((s, v) => s + v, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-t`} className="text-base font-semibold text-texto">
          Actividad · 14 días
        </h2>
        <div role="group" aria-label="Serie" className="flex rounded-full border border-borde bg-superficie-2 p-1">
          {SERIES_ACTIVIDAD.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={serie === s}
              onClick={() => setSerie(s)}
              className={`min-h-9 rounded-full px-3 text-sm font-medium transition-colors ${CLASE_FOCO} ${serie === s ? 'bg-superficie text-texto shadow-suave' : 'text-texto-suave hover:text-texto'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[420px]" role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} data-actividad={serie}>
          <desc id={`${id}-d`}>{`${total} ${DESCRIPCION_SERIE[serie]} en los últimos 14 días; hoy, ${datos.at(-1) ?? 0}.`}</desc>
          {[0, 0.5, 1].map((g) => {
            const y = 8 + (H - abajo - 8) * (1 - g);
            return (
              <g key={g}>
                <line x1={izq} x2={W} y1={y} y2={y} strokeDasharray="3 4" className="stroke-borde" />
                <text x={izq - 6} y={y + 4} textAnchor="end" className="fill-texto-suave font-mono text-[10px]">
                  {Math.round(tope * g)}
                </text>
              </g>
            );
          })}
          {datos.map((v, i) => {
            const h = ((H - abajo - 8) * v) / tope;
            const x = izq + 4 + i * ancho;
            const hoy = i === datos.length - 1;
            return (
              <g key={dias[i] ?? i}>
                <rect x={x} y={H - abajo - h} width={Math.max(2, ancho - 8)} height={Math.max(h, 1)} rx="5" className={hoy ? 'fill-acento' : 'fill-acento/40'}>
                  <title>{`${dias[i] ?? ''}: ${v}`}</title>
                </rect>
                {(i % 2 === 1 || hoy) && (
                  <text x={x + (ancho - 8) / 2} y={H - 8} textAnchor="middle" className="fill-texto-suave font-mono text-[10px]">
                    {diaDelMes(dias[i] ?? '')}
                  </text>
                )}
                {hoy && (
                  <text x={x + (ancho - 8) / 2} y={H - abajo - h - 6} textAnchor="middle" className="fill-texto text-[11px] font-semibold">
                    {v}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <details className="text-sm">
        <summary className={`inline-flex min-h-9 cursor-pointer items-center rounded font-medium text-acento ${CLASE_FOCO}`}>Ver los datos en una tabla</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Actividad de los últimos 14 días</caption>
            <thead>
              <tr>
                <th className="border-b border-borde px-2 py-1.5 font-semibold text-texto">Día</th>
                {SERIES_ACTIVIDAD.map((s) => (
                  <th key={s} className="border-b border-borde px-2 py-1.5 font-semibold text-texto">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dias.map((d, i) => (
                <tr key={d}>
                  <td className="border-b border-borde px-2 py-1.5 text-texto tabular-nums">{d}</td>
                  {SERIES_ACTIVIDAD.map((s) => (
                    <td key={s} className="border-b border-borde px-2 py-1.5 text-texto tabular-nums">
                      {series[s][i] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
