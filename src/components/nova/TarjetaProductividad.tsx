'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Anillo, type TonoAnillo } from '@/components/ui/Anillo';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Contador } from '@/components/ui/Contador';
import { Insignia, type TonoInsignia } from '@/components/ui/Insignia';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { ResultadoProductividad } from '@/lib/dataService';
import { MINUTOS_TOPE_INDICE } from '@/lib/config/nova';
import { formatearFecha, formatearMinutos } from '@/lib/formato';
import { MENSAJES } from '@/lib/reglas/errores';
import { aplicarMascaraFecha, esFechaISOValida } from '@/lib/reglas/fechas';
import type { NivelProductividad } from '@/lib/reglas/productividad';

// El nivel se dice con texto; el color solo lo refuerza.
const TONO: Record<NivelProductividad, TonoInsignia> = { Bajo: 'peligro', Aceptable: 'aviso', Excelente: 'exito' };
const TONO_ANILLO: Record<NivelProductividad, TonoAnillo> = { Bajo: 'peligro', Aceptable: 'aviso', Excelente: 'exito' };

/** E20b (commit 8): barra que se llena al aparecer; decorativa (el dato va en texto al lado). */
function Barra({ fraccion, clase = 'bg-acento' }: { fraccion: number; clase?: string }) {
  return (
    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-superficie-2">
      <div className={`nova-avance h-full rounded-full ${clase}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, fraccion)) * 100)}%` }} />
    </div>
  );
}
const SIN_TAREAS = 'Sin tareas programadas para esta fecha'; // sección 5.1, RN-18

const unDecimal = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'resultado'; datos: ResultadoProductividad }
  | { tipo: 'sinTareas'; fecha: string }
  | { tipo: 'error'; mensaje: string };

/** CU-05: `hoy` llega del servidor (Bogotá) para que el valor inicial no dependa del reloj del navegador. */
export function TarjetaProductividad({ hoy }: { hoy: string }) {
  const [fecha, setFecha] = useState(hoy);
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const inicial = useRef(false);

  async function calcular(dia: string) {
    setEstado({ tipo: 'cargando' });
    try {
      const respuesta = await fetch('/api/nova/productividad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: dia }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        datos?: ResultadoProductividad | { sinTareas: true };
        error?: { mensaje?: string };
      } | null;
      if (!respuesta.ok || !cuerpo?.ok || !cuerpo.datos) {
        setEstado({ tipo: 'error', mensaje: cuerpo?.error?.mensaje ?? MENSAJES.ERROR_INTERNO });
        return;
      }
      setEstado('sinTareas' in cuerpo.datos ? { tipo: 'sinTareas', fecha: dia } : { tipo: 'resultado', datos: cuerpo.datos });
    } catch {
      setEstado({ tipo: 'error', mensaje: 'No se pudo conectar con el servidor. Intenta de nuevo.' });
    }
  }

  // Una sola vez al montar: en desarrollo React monta dos veces y cada cálculo pide una recomendación a Gemini.
  useEffect(() => {
    if (inicial.current) return;
    inicial.current = true;
    void calcular(hoy);
  }, [hoy]);

  const valida = esFechaISOValida(fecha);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (valida) void calcular(fecha);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-60">
          <Campo
            id="fecha"
            etiqueta="Fecha"
            value={fecha}
            onChange={(e) => setFecha(aplicarMascaraFecha(e.target.value))}
            error={fecha.length === 10 && !valida ? MENSAJES.FECHA_INVALIDA : undefined}
            placeholder="AAAA-MM-DD"
            inputMode="numeric"
            maxLength={10}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton type="submit" disabled={!valida} cargando={estado.tipo === 'cargando'}>
            Calcular
          </Boton>
          {fecha !== hoy && (
            <Boton
              variante="secundario"
              onClick={() => {
                setFecha(hoy);
                void calcular(hoy);
              }}
            >
              Hoy
            </Boton>
          )}
        </div>
      </form>

      {estado.tipo === 'cargando' && (
        <p role="status" className="text-sm text-texto-suave">
          Calculando…
        </p>
      )}
      {estado.tipo === 'error' && <Aviso tipo="error">{estado.mensaje}</Aviso>}
      {estado.tipo === 'sinTareas' && (
        <Aviso tipo="info">
          {SIN_TAREAS}: {formatearFecha(estado.fecha)}.
        </Aviso>
      )}
      {estado.tipo === 'resultado' && <Resultado datos={estado.datos} />}
    </div>
  );
}

function Resultado({ datos }: { datos: ResultadoProductividad }) {
  return (
    <Tarjeta className="flex flex-col gap-4">
      <p className="text-sm text-texto-suave">{formatearFecha(datos.fecha)}</p>
      {/* E20b (commit 8): los puntos en un anillo del color del nivel, que se llena y cuenta al aparecer. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Anillo fraccion={datos.puntos / 100} tono={TONO_ANILLO[datos.nivel]}>
          <p className="flex flex-col items-center leading-none">
            <span className="font-display text-2xl font-extrabold text-texto">
              <Contador valor={Math.round(datos.puntos * 10)} formato="decimas" />
            </span>
            <span className="mt-1 text-xs text-texto-suave">de 100</span>
            <span className="sr-only"> puntos ({unDecimal.format(datos.puntos)})</span>
          </p>
        </Anillo>
        <div className="flex min-w-48 flex-1 flex-col gap-3">
          <div>
            <Insignia tono={TONO[datos.nivel]}>Nivel: {datos.nivel}</Insignia>
          </div>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between gap-3">
                <dt className="text-texto-suave">Tareas completadas</dt>
                <dd className="font-semibold text-texto tabular-nums">
                  {datos.completadas} de {datos.totales}
                </dd>
              </div>
              <Barra fraccion={datos.totales ? datos.completadas / datos.totales : 0} clase={datos.completadas === datos.totales ? 'bg-exito' : 'bg-acento'} />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between gap-3">
                <dt className="text-texto-suave">Minutos dedicados</dt>
                <dd className="font-semibold text-texto tabular-nums">
                  {formatearMinutos(datos.minutos)}
                  {datos.minutos > MINUTOS_TOPE_INDICE && ` (cuentan ${MINUTOS_TOPE_INDICE})`}
                </dd>
              </div>
              <Barra fraccion={datos.minutos / MINUTOS_TOPE_INDICE} />
            </div>
          </dl>
        </div>
      </div>
      <p className="text-xs text-texto-suave">
        Puntos = completadas ÷ tareas del día × 70 + minutos (hasta {MINUTOS_TOPE_INDICE}) × 0,25, redondeado hacia abajo a un
        decimal. Bajo: menos de 50; Aceptable: de 50 a 79,9; Excelente: desde 80.
      </p>
      <div className="flex gap-3 rounded-xl border border-borde bg-superficie-2 p-3">
        <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-acento" />
        <div>
          <h2 className="text-sm font-semibold text-texto">Recomendación</h2>
          <p className={`mt-1 text-sm ${datos.recomendacionDisponible ? 'text-texto' : 'text-texto-suave'}`}>
            {datos.recomendacion}
          </p>
        </div>
      </div>
    </Tarjeta>
  );
}
