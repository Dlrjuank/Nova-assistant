'use client';

import { useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Campo } from '@/components/ui/Campo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { Materia } from '@/lib/dataService';
import {
  calcularCorte,
  calcularMateria,
  cuantoNecesito,
  estadoConFallas,
  estadoDe,
  estadoFallas,
  SIN_NOTAS,
  textoCuantoNecesito,
  textoNota,
  textoPeso,
  validarMeta,
} from '@/lib/reglas/notas';
import { formatearNota, formatearPorcentaje, type Redondeo } from '@/lib/reglas/preferencias';
import { entradaDe, InsigniaEstadoMateria } from './estadoMateria';
import { mensajeDe } from './peticion';

/**
 * E13 (5.7, 7.4, 7.5; RB-12, RB-18): nota actual, asegurado, nota de cada corte, estado y "¿Cuánto necesito?" con
 * una nota meta que no se guarda (por defecto, la nota para aprobar de Configuración). Con porcentajes que no
 * suman 100 %, solo la nota actual.
 */
export function Calculadora({ materia, notaAprobar, redondeo, metaGuardada = null }: { materia: Materia; notaAprobar: number; redondeo: Redondeo; metaGuardada?: number | null }) {
  const entrada = entradaDe(materia);
  const calculo = calcularMateria(entrada);
  // E14 (7.7): perdida por fallas, "En riesgo" aunque las notas aprueben.
  const estado = estadoConFallas(estadoDe(calculo, notaAprobar, redondeo), estadoFallas(materia.fallasLimite, materia.fallasRegistradas));
  // E16: la meta guardada de la materia (Objetivos y plan) es el valor inicial; si no hay, la nota para aprobar.
  const [meta, setMeta] = useState(formatearNota(metaGuardada ?? notaAprobar));
  const errorMeta = mensajeDe(() => validarMeta(meta));
  const necesito = errorMeta ? null : cuantoNecesito(calculo, validarMeta(meta), redondeo);

  return (
    <Tarjeta className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-texto">Calculadora</h2>
      {calculo.actual === null ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
          {SIN_NOTAS}
          {estado && <InsigniaEstadoMateria estado={estado} />}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-sm text-texto-suave">{calculo.definitiva ? 'Nota definitiva' : 'Nota actual'}</p>
            <p className="flex items-center gap-3">
              <span className="text-4xl font-semibold text-texto tabular-nums">{textoNota(calculo.actual, redondeo)}</span>
              {estado && <InsigniaEstadoMateria estado={estado} />}
            </p>
          </div>
          {/* Con todo calificado, lo asegurado es la definitiva: no se repite. */}
          {!calculo.definitiva && (
            <div className="flex flex-col gap-0.5 text-sm text-texto">
              <span>
                Asegurado: <strong className="tabular-nums">{textoNota(calculo.asegurado, redondeo)}</strong> de 5,0
              </span>
              {calculo.sumasOk && <span className="text-texto-suave">Falta por calificar: {textoPeso(calculo.pendiente)} %</span>}
            </div>
          )}
        </div>
      )}
      {calculo.actual !== null && <p className="text-xs text-texto-suave">La nota actual promedia solo lo calificado: lo que falta no cuenta como 0.</p>}

      {materia.usaCortes && (
        <ul aria-label="Nota de cada corte" className="flex flex-col divide-y divide-borde rounded-xl border border-borde">
          {materia.cortes.map((c, i) => {
            const nota = calcularCorte(entrada.cortes[i] as (typeof entrada.cortes)[number]).actual;
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-texto">
                  {c.nombre} <span className="text-texto-suave">({formatearPorcentaje(c.porcentaje)} %)</span>
                </span>
                <span className={nota ? 'font-semibold text-texto tabular-nums' : 'text-texto-suave'}>{nota ? textoNota(nota, redondeo) : 'Sin notas'}</span>
              </li>
            );
          })}
        </ul>
      )}

      {!calculo.sumasOk ? (
        <Aviso tipo="info">Para ver el estado y «¿Cuánto necesito?», los porcentajes deben sumar 100 %.</Aviso>
      ) : (
        <div className="flex flex-col gap-3 border-t border-borde pt-4">
          <h3 className="text-base font-semibold text-texto">¿Cuánto necesito?</h3>
          <div className="sm:w-48">
            <Campo
              id="nota-meta"
              etiqueta="Nota meta"
              value={meta}
              inputMode="decimal"
              maxLength={4}
              onChange={(e) => setMeta(e.target.value)}
              error={errorMeta}
              ayuda={metaGuardada === null ? 'Por defecto, la nota para aprobar. No se guarda.' : 'Por defecto, tu meta de Objetivos y plan. Lo que escribas aquí no se guarda.'}
            />
          </div>
          {necesito && (
            <p role="status" className="text-base font-medium text-texto">
              {textoCuantoNecesito(necesito, validarMeta(meta))}
            </p>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
