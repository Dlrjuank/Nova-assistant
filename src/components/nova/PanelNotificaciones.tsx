'use client';

import { Bell, BellOff, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { activarNotificaciones, desactivarNotificaciones, estadoNotificaciones, type EstadoNotificaciones } from '@/lib/notificaciones';
import { AVISO_ACTIVAR, AVISO_BLOQUEADAS, AVISO_IPHONE_SIN_INSTALAR } from '@/lib/reglas/recordatorios';

const NO_SOPORTADO = 'Este navegador no puede recibir notificaciones de Nova.';
const ACTIVAS = 'Este dispositivo recibe los avisos de Nova.';

/**
 * E11c (5.10, RB-45): estado de las notificaciones en este dispositivo y el botón "Activar notificaciones". El
 * permiso se pide solo al tocarlo. En el formulario de una tarea aparece al elegir un recordatorio y no dice nada
 * si ya están activas; en Configuración además ofrece "Enviar una de prueba" y desactivarlas.
 */
export function PanelNotificaciones({ modo }: { modo: 'formulario' | 'configuracion' }) {
  const [estado, setEstado] = useState<EstadoNotificaciones | 'cargando'>('cargando');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [prueba, setPrueba] = useState('');

  useEffect(() => {
    let vivo = true;
    estadoNotificaciones()
      .then((e) => vivo && setEstado(e))
      .catch(() => vivo && setEstado('no-soportado'));
    return () => {
      vivo = false;
    };
  }, []);

  async function hacer(accion: () => Promise<EstadoNotificaciones>) {
    setError('');
    setPrueba('');
    setOcupado(true);
    try {
      setEstado(await accion());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron activar las notificaciones en este dispositivo. Intenta de nuevo.');
    } finally {
      setOcupado(false);
    }
  }

  async function enviarPrueba() {
    setError('');
    setPrueba('');
    setOcupado(true);
    try {
      const r = await fetch('/api/nova/notificaciones/prueba', { method: 'POST' });
      const d = (await r.json().catch(() => null)) as { ok?: boolean; error?: { mensaje?: string } } | null;
      if (!r.ok || !d?.ok) setError(d?.error?.mensaje ?? 'No se pudo enviar la notificación de prueba.');
      else setPrueba('Listo: la notificación de prueba va en camino.');
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setOcupado(false);
    }
  }

  if (estado === 'cargando') return null;
  if (modo === 'formulario' && estado === 'activas') return null;

  return (
    <div className="flex flex-col gap-3" data-testid="panel-notificaciones">
      {estado === 'iphone-sin-instalar' && (
        <Aviso tipo="info">
          {AVISO_IPHONE_SIN_INSTALAR} En Safari: Compartir › «Agregar a inicio». Luego abre Nova desde su ícono e inicia sesión.
        </Aviso>
      )}
      {estado === 'bloqueadas' && <Aviso tipo="advertencia">{AVISO_BLOQUEADAS}</Aviso>}
      {estado === 'no-soportado' && <Aviso tipo="info">{NO_SOPORTADO}</Aviso>}
      {estado === 'inactivas' && (
        <>
          {modo === 'formulario' && <p className="text-sm text-texto-suave">{AVISO_ACTIVAR}</p>}
          <div>
            <Boton variante={modo === 'formulario' ? 'secundario' : 'primario'} cargando={ocupado} onClick={() => void hacer(activarNotificaciones)}>
              <Bell aria-hidden="true" className="size-4" />
              Activar notificaciones
            </Boton>
          </div>
        </>
      )}
      {estado === 'activas' && (
        <>
          <Aviso tipo="exito">{ACTIVAS}</Aviso>
          <div className="flex flex-wrap gap-3">
            <Boton cargando={ocupado} onClick={() => void enviarPrueba()}>
              <Send aria-hidden="true" className="size-4" />
              Enviar una de prueba
            </Boton>
            <Boton variante="secundario" disabled={ocupado} onClick={() => void hacer(desactivarNotificaciones)}>
              <BellOff aria-hidden="true" className="size-4" />
              Desactivar en este dispositivo
            </Boton>
          </div>
        </>
      )}
      {prueba && <Aviso tipo="exito">{prueba}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
    </div>
  );
}
