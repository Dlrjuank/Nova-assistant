'use client';

import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormatoHora } from '@/components/nova/PreferenciasNova';
import { guardarEventoInstalar, type EventoInstalar } from '@/lib/instalacion';
import { formatearHora } from '@/lib/reglas/horario';
import { bloqueadoSinConexion, NECESITAS_CONEXION, textoSinConexion } from '@/lib/reglas/sinConexion';

const ATRIBUTO_HTML = 'data-nova-sin-conexion';

/** La hora de la copia que trajo el service worker, si esta página salió de ella. */
function horaDeCopia(): Date | null {
  const contenido = document.querySelector('meta[name="nova-copia"]')?.getAttribute('content');
  const fecha = contenido ? new Date(contenido) : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
}

/**
 * E11b (5.10, RB-62): registra el service worker, muestra `Sin conexión · datos de las HH:MM` y, mientras no
 * hay conexión, desactiva todo lo que escribe datos o necesita internet con `Necesitas conexión para esto.`
 * Al volver la conexión, una página que salió de la copia se recarga con los datos nuevos.
 */
export function ConexionNova() {
  const formato = useFormatoHora();
  const [copia, setCopia] = useState<Date | null>(null);
  const [enLinea, setEnLinea] = useState(true);
  const [cargadaEn] = useState(() => new Date());
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    setCopia(horaDeCopia());
    setEnLinea(navigator.onLine);
    const alVolver = () => {
      setEnLinea(true);
      if (horaDeCopia()) window.location.reload(); // la copia es una foto: se pide la página de verdad
    };
    const alPerder = () => setEnLinea(false);
    window.addEventListener('online', alVolver);
    window.addEventListener('offline', alPerder);
    return () => {
      window.removeEventListener('online', alVolver);
      window.removeEventListener('offline', alPerder);
    };
  }, []);

  useEffect(() => {
    // Solo en producción: en desarrollo los archivos cambian a cada rato y la copia confundiría.
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/nova' }).catch((error: unknown) => {
      console.warn('No se pudo registrar el service worker:', error instanceof Error ? error.message : error);
    });
  }, []);

  useEffect(() => {
    const guardar = (e: Event) => {
      e.preventDefault(); // se ofrece desde Configuración → "Instalar Nova"
      guardarEventoInstalar(e as EventoInstalar);
    };
    const instalada = () => guardarEventoInstalar(null);
    window.addEventListener('beforeinstallprompt', guardar);
    window.addEventListener('appinstalled', instalada);
    return () => {
      window.removeEventListener('beforeinstallprompt', guardar);
      window.removeEventListener('appinstalled', instalada);
    };
  }, []);

  const sinConexion = copia !== null || !enLinea;

  useEffect(() => {
    if (!sinConexion) return;
    document.documentElement.setAttribute(ATRIBUTO_HTML, '');
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const bloquear = (e: Event) => {
      const objetivo = e.target;
      if (!(objetivo instanceof Element) || !bloqueadoSinConexion(objetivo, window.location.origin, new Date())) return;
      if (e.type === 'keydown' && !['Enter', ' '].includes((e as KeyboardEvent).key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'focusin' && objetivo instanceof HTMLElement && objetivo.matches('input, textarea, select')) objetivo.blur();
      setAviso(NECESITAS_CONEXION);
      clearTimeout(temporizador);
      temporizador = setTimeout(() => setAviso(''), 3000);
    };
    const tipos = ['click', 'keydown', 'submit', 'focusin'] as const;
    tipos.forEach((t) => document.addEventListener(t, bloquear, true));
    return () => {
      tipos.forEach((t) => document.removeEventListener(t, bloquear, true));
      document.documentElement.removeAttribute(ATRIBUTO_HTML);
      clearTimeout(temporizador);
    };
  }, [sinConexion]);

  if (!sinConexion) return null;
  return (
    <>
      <p role="status" className="flex items-center gap-2 self-start rounded-full bg-superficie-2 px-3 py-1.5 text-sm font-medium text-texto">
        <WifiOff aria-hidden="true" className="size-4 shrink-0 text-texto-suave" />
        {textoSinConexion(copia ?? cargadaEn, (h) => formatearHora(h, formato))}
      </p>
      <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-6">
        {aviso && <p className="rounded-xl bg-texto px-4 py-2 text-sm font-medium text-fondo shadow-suave">{aviso}</p>}
      </div>
    </>
  );
}
