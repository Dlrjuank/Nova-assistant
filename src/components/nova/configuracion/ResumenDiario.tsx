'use client';

import { useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { MENSAJES } from '@/lib/reglas/errores';
import { formatearHora } from '@/lib/reglas/horario';
import type { FormatoHora } from '@/lib/reglas/preferencias';
import { resumenPuedeLlegarHoy } from '@/lib/reglas/recordatorios';
import { guardarConfiguracion } from './guardar';

/**
 * E11d (5.10, RB-46): el resumen diario opcional, en Configuración → Notificaciones. Una notificación por día a la
 * hora elegida, solo si hay tareas de hoy o vencidas. Llega a los dispositivos con notificaciones activas.
 */
export function ResumenDiario({
  activo,
  hora,
  formatoHora,
}: {
  activo: boolean;
  hora: string;
  formatoHora: FormatoHora;
}) {
  const [encendido, setEncendido] = useState(activo);
  const [valor, setValor] = useState(hora);
  const [guardado, setGuardado] = useState({ activo, hora });
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [hoyYaPaso, setHoyYaPaso] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const sinCambios = encendido === guardado.activo && valor === guardado.hora;

  async function guardar() {
    setError('');
    setListo(false);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) {
      setError(MENSAJES.HORA_RESUMEN_INVALIDA);
      return;
    }
    setGuardando(true);
    const r = await guardarConfiguracion({ resumenDiario: encendido, horaResumen: valor });
    setGuardando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setGuardado({ activo: encendido, hora: valor });
    setHoyYaPaso(!resumenPuedeLlegarHoy(valor));
    setListo(true);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-borde pt-4">
      <h3 className="text-sm font-semibold text-texto">Resumen diario</h3>
      <div className="flex items-start gap-3">
        <input
          id="resumenDiario"
          type="checkbox"
          checked={encendido}
          onChange={(e) => {
            setEncendido(e.target.checked);
            setListo(false);
          }}
          className="mt-0.5 size-5 shrink-0 accent-acento"
        />
        <label htmlFor="resumenDiario" className="flex flex-col">
          <span className="text-sm font-medium text-texto">Recibir un resumen cada día</span>
          <span className="text-xs text-texto-suave">
            Una notificación con tus tareas de hoy y las vencidas, como «Hoy: 3 tareas · 1 vencida».
            Los días sin ninguna no llega.
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Campo
            id="horaResumen"
            etiqueta="Hora del resumen"
            type="time"
            step={300}
            value={valor}
            disabled={!encendido}
            onChange={(e) => {
              setValor(e.target.value);
              setListo(false);
            }}
            error={error || undefined}
          />
        </div>
        <Boton
          variante="secundario"
          cargando={guardando}
          disabled={sinCambios}
          onClick={() => void guardar()}
        >
          Guardar resumen
        </Boton>
      </div>
      {listo && (
        <Aviso tipo="exito">
          {guardado.activo
            ? hoyYaPaso
              ? `Guardado. Hoy ya pasó esa hora: el resumen empieza mañana a las ${formatearHora(guardado.hora, formatoHora)}.`
              : `Guardado. El resumen llegará cada día a las ${formatearHora(guardado.hora, formatoHora)}.`
            : 'Guardado. Ya no recibirás el resumen diario.'}
        </Aviso>
      )}
    </div>
  );
}
