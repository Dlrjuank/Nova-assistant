'use client';

import { WifiOff } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useFormatoHora } from '@/components/nova/PreferenciasNova';
import { cargarPagina, marcarSalida, reiniciarSalida, saliendoDePagina } from '@/lib/cargarPagina';
import { guardarEventoInstalar, type EventoInstalar } from '@/lib/instalacion';
import { formatearHora } from '@/lib/reglas/horario';
import { bloqueadoSinConexion, ESPERA_GUARDAR_MS, NECESITAS_CONEXION, RUTA_NUEVA_TAREA, rutaConCopia, textoSinConexion } from '@/lib/reglas/sinConexion';

/**
 * Al moverse con el menú o un enlace, Next cambia de pantalla sin recargar (pedido RSC) y el service worker no ve
 * una carga completa que guardar. Por eso, en cada cambio de ruta a una pantalla guardable, se le pide guardarla.
 * La primera carga ya la guarda el service worker si controla la página; si todavía no la controla, también se pide.
 *
 * Para no competir con la navegación, el pedido sale cuando la pantalla nueva ya se mostró, lleva un rato quieta
 * (ESPERA_GUARDAR_MS) y el navegador está libre; si se cambia de pantalla antes, se cancela. El service worker,
 * además, no la vuelve a pedir si ya tiene una copia reciente.
 */
function AvisarRuta({ activa }: { activa: boolean }) {
  const ruta = usePathname() ?? '/nova';
  const parametros = useSearchParams()?.toString() ?? '';
  const primera = useRef(true);

  useEffect(() => {
    const esPrimera = primera.current;
    primera.current = false;
    // Se mira aquí también: en el primer render el estado de conexión todavía no está leído.
    if (!activa || !('serviceWorker' in navigator) || !navigator.onLine || horaDeCopia()) return;
    if (esPrimera && navigator.serviceWorker.controller) return;
    const url = new URL(`${ruta}${parametros ? `?${parametros}` : ''}`, window.location.origin);
    if (!rutaConCopia(url, new Date())) return;

    let cancelado = false;
    let libre: number | undefined;
    const enviar = () => {
      if (cancelado || !navigator.onLine) return;
      // `getRegistration` y no `ready`: tras iniciar sesión la pestaña nació en /login, fuera del alcance, y
      // `ready` no se resuelve nunca en ella.
      navigator.serviceWorker
        .getRegistration('/nova')
        .then((registro) => registro?.active?.postMessage({ tipo: 'nova-guardar-ruta', url: url.href }))
        .catch(() => undefined);
    };
    const temporizador = window.setTimeout(() => {
      // Safari no tiene requestIdleCallback: ahí basta la espera.
      if (typeof window.requestIdleCallback === 'function') libre = window.requestIdleCallback(enviar, { timeout: 3000 });
      else enviar();
    }, ESPERA_GUARDAR_MS);
    return () => {
      cancelado = true;
      window.clearTimeout(temporizador);
      if (libre !== undefined) window.cancelIdleCallback?.(libre);
    };
  }, [ruta, parametros, activa]);

  return null;
}

/**
 * E11c: al tocar una notificación con Nova ya abierta, el service worker la trae al frente y le pide ir a la
 * pantalla de la notificación (Tareas con la tarea resaltada), sin recargar.
 */
function AbrirDesdeNotificacion() {
  const router = useRouter();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const alMensaje = (e: MessageEvent) => {
      const datos = e.data as { tipo?: string; url?: string } | null;
      if (datos?.tipo === 'nova-abrir' && typeof datos.url === 'string' && /^\/nova(\/|\?|$)/.test(datos.url) && !datos.url.includes('//')) {
        router.push(datos.url);
      }
    };
    const sw = navigator.serviceWorker;
    if (typeof sw?.addEventListener !== 'function') return;
    sw.addEventListener('message', alMensaje);
    return () => sw.removeEventListener('message', alMensaje);
  }, [router]);
  return null;
}

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
      // La copia es una foto: se pide la página de verdad. E11e: no en el formulario de nueva tarea, que puede
      // estar a medio llenar (al guardar ya hay conexión y se envía normal), ni si la página ya se está yendo a
      // otra: el navegador puede avisar "online" justo al salir y la recarga se comería esa navegación.
      if (horaDeCopia() && navigator.onLine && !saliendoDePagina() && window.location.pathname !== RUTA_NUEVA_TAREA) window.location.reload();
    };
    const alPerder = () => setEnLinea(false);
    const alSalir = () => marcarSalida();
    const alMostrar = (e: PageTransitionEvent) => {
      if (e.persisted) reiniciarSalida();
    };
    window.addEventListener('pageshow', alMostrar);
    window.addEventListener('online', alVolver);
    window.addEventListener('offline', alPerder);
    window.addEventListener('pagehide', alSalir);
    window.addEventListener('beforeunload', alSalir);
    return () => {
      window.removeEventListener('online', alVolver);
      window.removeEventListener('offline', alPerder);
      window.removeEventListener('pagehide', alSalir);
      window.removeEventListener('beforeunload', alSalir);
      window.removeEventListener('pageshow', alMostrar);
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
      if (!(objetivo instanceof Element)) return;
      if (!bloqueadoSinConexion(objetivo, window.location.origin, new Date())) {
        // E11e: un enlace permitido (a una pantalla con copia) se abre con una carga completa, que el service
        // worker sirve desde la copia. La navegación de Next sin conexión a veces se queda sin cambiar de pantalla.
        const enlace = e.type === 'click' ? objetivo.closest('a[href]') : null;
        const clic = e as MouseEvent;
        if (enlace && !clic.metaKey && !clic.ctrlKey && !clic.shiftKey && clic.button === 0 && enlace.getAttribute('target') !== '_blank') {
          const destino = new URL(enlace.getAttribute('href') as string, window.location.origin);
          if (destino.origin === window.location.origin && destino.href !== window.location.href) {
            e.preventDefault();
            e.stopPropagation();
            cargarPagina(destino.href);
          }
        }
        return;
      }
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

  // Solo con conexión y en producción, igual que el registro del service worker.
  const avisar = (
    <>
      <Suspense fallback={null}>
        <AvisarRuta activa={!sinConexion && process.env.NODE_ENV === 'production'} />
      </Suspense>
      <AbrirDesdeNotificacion />
    </>
  );
  if (!sinConexion) return avisar;
  return (
    <>
      {avisar}
      <p role="status" className="flex items-center gap-2 self-start rounded-full bg-superficie-2 px-3 py-1.5 text-sm font-medium text-texto">
        <WifiOff aria-hidden="true" className="size-4 shrink-0 text-texto-suave" />
        {textoSinConexion(copia ?? cargadaEn, (h) => formatearHora(h, formato))}
      </p>
      <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+var(--nova-seguro-abajo))] z-50 flex justify-center px-4 lg:bottom-6">
        {aviso && <p className="rounded-xl bg-texto px-4 py-2 text-sm font-medium text-fondo shadow-suave">{aviso}</p>}
      </div>
    </>
  );
}
