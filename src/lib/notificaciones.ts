/**
 * E11c (5.10, RB-45): notificaciones en este dispositivo, del lado del navegador. El permiso solo se pide dentro
 * de `activarNotificaciones`, que se llama al tocar "Activar notificaciones" (nunca al abrir la app).
 * No va en un archivo 'use client': son funciones del navegador sin React.
 */
import { abiertaComoApp, esIos } from '@/lib/instalacion';

export type EstadoNotificaciones =
  /** El navegador no tiene notificaciones push, o Nova no tiene service worker (en desarrollo). */
  | 'no-soportado'
  /** RB-45: en el iPhone solo funcionan con Nova agregada a inicio. */
  | 'iphone-sin-instalar'
  /** El usuario las negó: solo se reactivan desde los ajustes. */
  | 'bloqueadas'
  /** Se pueden activar con el botón. */
  | 'inactivas'
  /** Este dispositivo recibe los avisos. */
  | 'activas';

function hayPush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registro(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration('/nova');
}

/** El estado de este dispositivo, sin pedir nada. */
export async function estadoNotificaciones(): Promise<EstadoNotificaciones> {
  if (typeof window === 'undefined') return 'no-soportado';
  if (esIos() && !abiertaComoApp()) return 'iphone-sin-instalar';
  if (!hayPush()) return 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueadas';
  const r = await registro();
  if (!r) return 'no-soportado';
  const suscripcion = await r.pushManager.getSubscription();
  return suscripcion && Notification.permission === 'granted' ? 'activas' : 'inactivas';
}

/** De base64url (la clave VAPID) a los bytes que pide pushManager.subscribe. */
export function claveABytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const binario = atob((base64url + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Un nombre corto del dispositivo para la lista de Configuración ("iPhone", "Android", "Windows"...). */
export function nombreDispositivo(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'Otro dispositivo';
}

async function leerRespuesta(respuesta: Response): Promise<{ ok: boolean; datos?: unknown; error?: { mensaje?: string } }> {
  return (await respuesta.json().catch(() => ({ ok: false }))) as { ok: boolean; datos?: unknown; error?: { mensaje?: string } };
}

/**
 * RB-45: pide el permiso (solo aquí), suscribe este dispositivo y lo guarda en el servidor. Devuelve el estado
 * final; lanza un Error con un mensaje para mostrar si algo falla.
 */
export async function activarNotificaciones(): Promise<EstadoNotificaciones> {
  const inicial = await estadoNotificaciones();
  if (inicial !== 'inactivas' && inicial !== 'activas') return inicial;
  const permiso = await Notification.requestPermission();
  if (permiso === 'denied') return 'bloqueadas';
  if (permiso !== 'granted') return 'inactivas';
  const r = await registro();
  if (!r) return 'no-soportado';
  const config = await leerRespuesta(await fetch('/api/nova/notificaciones', { cache: 'no-store' }));
  const clave = (config.datos as { clavePublica?: string | null } | undefined)?.clavePublica;
  if (!config.ok || !clave) throw new Error(config.error?.mensaje ?? 'Las notificaciones todavía no están disponibles en este servidor.');
  const suscripcion = (await r.pushManager.getSubscription()) ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(clave) }));
  const guardada = await leerRespuesta(
    await fetch('/api/nova/notificaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...suscripcion.toJSON(), dispositivo: nombreDispositivo() }),
    }),
  );
  if (!guardada.ok) throw new Error(guardada.error?.mensaje ?? 'No se pudieron activar las notificaciones en este dispositivo. Intenta de nuevo.');
  return 'activas';
}

/** Deja de recibir avisos en este dispositivo (los demás siguen). */
export async function desactivarNotificaciones(): Promise<EstadoNotificaciones> {
  const r = await registro();
  const suscripcion = await r?.pushManager.getSubscription();
  if (suscripcion) {
    await fetch('/api/nova/notificaciones', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: suscripcion.endpoint }),
    }).catch(() => undefined);
    await suscripcion.unsubscribe().catch(() => false);
  }
  return estadoNotificaciones();
}
