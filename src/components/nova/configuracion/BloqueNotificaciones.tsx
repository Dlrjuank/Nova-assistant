'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PanelNotificaciones } from '@/components/nova/PanelNotificaciones';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { MENSAJES } from '@/lib/reglas/errores';
import { formatearHora } from '@/lib/reglas/horario';
import type { FormatoHora } from '@/lib/reglas/preferencias';
import { guardarConfiguracion } from './guardar';

/**
 * E11c (5.10, RB-45): Configuración → Notificaciones. Este dispositivo (activar, enviar una de prueba, desactivar)
 * y la hora fija de los recordatorios de las tareas sin horario. El resumen diario llega en E11d.
 */
export function BloqueNotificaciones({ horaRecordatorio, formatoHora }: { horaRecordatorio: string; formatoHora: FormatoHora }) {
  const router = useRouter();
  const [hora, setHora] = useState(horaRecordatorio);
  const [guardada, setGuardada] = useState(horaRecordatorio);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError('');
    setListo(false);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      setError(MENSAJES.HORA_RECORDATORIO_INVALIDA);
      return;
    }
    setGuardando(true);
    const r = await guardarConfiguracion({ horaRecordatorio: hora });
    setGuardando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setGuardada(hora);
    setListo(true);
    router.refresh();
  }

  return (
    <Tarjeta className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-texto">Notificaciones</h2>
      <p className="text-sm text-texto">
        Recibe el recordatorio de una tarea en la pantalla de bloqueo, como cualquier app. Se activan en cada dispositivo por separado.
      </p>
      <PanelNotificaciones modo="configuracion" />
      <div className="flex flex-col gap-3 border-t border-borde pt-4">
        <h3 className="text-sm font-semibold text-texto">Tareas sin horario</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Campo
              id="horaRecordatorio"
              etiqueta="Hora del recordatorio"
              type="time"
              step={300}
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              error={error || undefined}
            />
          </div>
          <Boton variante="secundario" cargando={guardando} disabled={hora === guardada} onClick={() => void guardar()}>
            Guardar hora
          </Boton>
        </div>
        <p className="text-xs text-texto-suave">
          «El mismo día» y «El día anterior» avisan a esta hora (ahora, a las {formatearHora(guardada, formatoHora)}).
        </p>
        {listo && <Aviso tipo="exito">Guardado. Los recordatorios pendientes de tareas sin horario usan la hora nueva.</Aviso>}
      </div>
    </Tarjeta>
  );
}
