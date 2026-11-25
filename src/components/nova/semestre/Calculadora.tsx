'use client';

import { CheckCircle2, CircleAlert, Sparkles, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Campo } from '@/components/ui/Campo';
import { Contador } from '@/components/ui/Contador';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { Materia } from '@/lib/dataService';
import {
  calcularCorte,
  calcularMateria,
  cuantoNecesito,
  estadoConFallas,
  estadoDe,
  estadoFallas,
  mostrar,
  SIN_NOTAS,
  type CuantoNecesito,
  textoCuantoNecesito,
  textoNota,
  textoPeso,
  validarMeta,
} from '@/lib/reglas/notas';
import { formatearNota, formatearPorcentaje, type Redondeo } from '@/lib/reglas/preferencias';
import { entradaDe, InsigniaEstadoMateria } from './estadoMateria';
import { mensajeDe } from './peticion';

type Tono = 'exito' | 'aviso' | 'peligro';

/** Desde cuántas décimas por obtener la meta se ve difícil (ámbar), como en el prototipo (4,2). */
export const NECESITO_DIFICIL = 42;

/**
 * E20b (commit 7): el color de la respuesta de "¿Cuánto necesito?". Verde: ya la aseguraste, la cumpliste o
 * necesitas hasta 4,2; ámbar: necesitas más de 4,2; rojo: no alcanzable o no la alcanzaste.
 */
export function tonoNecesito(r: CuantoNecesito, metaCentesimas: number): Tono {
  if (r.tipo === 'asegurado') return 'exito';
  if (r.tipo === 'imposible') return 'peligro';
  if (r.tipo === 'definitiva') return r.nota * 10 >= metaCentesimas ? 'exito' : 'peligro';
  return r.decimas > NECESITO_DIFICIL ? 'aviso' : 'exito';
}

const CLASE_TONO: Record<Tono, string> = {
  exito: 'border-exito/40 bg-exito/10',
  aviso: 'border-aviso/40 bg-aviso/10',
  peligro: 'border-peligro/40 bg-peligro/10',
};
const ICONO_TONO = { exito: CheckCircle2, aviso: CircleAlert, peligro: XCircle } as const;
const COLOR_ICONO: Record<Tono, string> = { exito: 'text-exito', aviso: 'text-aviso', peligro: 'text-peligro' };

/**
 * E20b (commit 7): los cortes como una barra, cada uno con su ancho según su porcentaje, lleno hasta su nota (de 5);
 * el corte sin notas va rayado. Solo de presentación: la lista de debajo dice lo mismo en texto.
 */
function BarraCortes({ cortes }: { cortes: Array<{ id: string; porcentaje: number; decimas: number | null }> }) {
  return (
    <div aria-hidden="true" data-barra-cortes className="flex h-3 gap-1">
      {cortes.map((c) => (
        <div
          key={c.id}
          data-corte-pendiente={c.decimas === null || undefined}
          style={{ flexGrow: Math.max(c.porcentaje, 1), flexBasis: 0 }}
          className={`overflow-hidden rounded-full bg-superficie-2 ${c.decimas === null ? 'nova-rayado' : ''}`}
        >
          {c.decimas !== null && <div className="nova-avance h-full rounded-full bg-acento" style={{ width: `${Math.min(100, (c.decimas / 50) * 100)}%` }} />}
        </div>
      ))}
    </div>
  );
}

/**
 * E13 (5.7, 7.4, 7.5; RB-12, RB-18): nota actual, asegurado, nota de cada corte, estado y "¿Cuánto necesito?" con
 * una nota meta que no se guarda (por defecto, la nota para aprobar de Configuración). Con porcentajes que no
 * suman 100 %, solo la nota actual.
 */
export function Calculadora({ materia, notaAprobar, redondeo, metaGuardada = null }: { materia: Materia; notaAprobar: number; redondeo: Redondeo; metaGuardada?: number | null }) {
  const entrada = entradaDe(materia);
  const calculo = calcularMateria(entrada);
  // E14 (7.7) y ajuste de E20: perdida por fallas, "Perdida" aunque las notas aprueben.
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
              <span className="text-4xl font-semibold text-texto tabular-nums">
                <Contador valor={mostrar(calculo.actual, redondeo)} formato="decimas" />
              </span>
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

      {materia.usaCortes && materia.cortes.length > 0 && (
        <BarraCortes
          cortes={materia.cortes.map((c, i) => {
            const nota = calcularCorte(entrada.cortes[i] as (typeof entrada.cortes)[number]).actual;
            return { id: c.id, porcentaje: c.porcentaje, decimas: nota ? mostrar(nota, redondeo) : null };
          })}
        />
      )}
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
          {/* E19b (RB-87): calcula solo en el navegador y no guarda: sigue funcionando sin conexión. */}
          <div className="sm:w-48" data-sin-conexion="permitido">
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
          {necesito && <RespuestaNecesito necesito={necesito} meta={validarMeta(meta)} />}
        </div>
      )}
    </Tarjeta>
  );
}

/** E20b (commit 7): la respuesta cambia de color al instante con la meta (verde, ámbar o rojo), con su ícono. */
function RespuestaNecesito({ necesito, meta }: { necesito: CuantoNecesito; meta: number }) {
  const tono = tonoNecesito(necesito, meta);
  const Icono = necesito.tipo === 'necesitas' && tono === 'exito' ? Sparkles : ICONO_TONO[tono];
  return (
    <p role="status" data-tono={tono} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-base font-medium text-texto transition-colors duration-200 ${CLASE_TONO[tono]}`}>
      <Icono aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${COLOR_ICONO[tono]}`} />
      {textoCuantoNecesito(necesito, meta)}
    </p>
  );
}
