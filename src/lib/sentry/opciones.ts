/**
 * Opciones de Sentry comunes al navegador, al servidor y al middleware (ajuste del 2026-11-26, pedido del usuario).
 *
 * Privacidad: Sentry solo recibe el error, dónde pasó y los pasos técnicos previos. Nunca la IP, las cookies ni el
 * contenido del usuario: se quitan los parámetros de las direcciones (por ejemplo `?pregunta=`, que lleva la pregunta
 * al Asistente) y los mensajes de la consola. Sin DSN (local y pruebas) Sentry queda apagado.
 */
import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';

/** Quita la consulta (`?…`) y el fragmento (`#…`) de una dirección. */
export function sinConsulta(url: string): string {
  const corte = url.search(/[?#]/);
  return corte === -1 ? url : url.slice(0, corte);
}

/** Los pasos previos al error, sin la consola ni los parámetros de las direcciones. */
export function filtrarMigaja(migaja: Breadcrumb): Breadcrumb | null {
  if (migaja.category === 'console') return null;
  const limpia: Breadcrumb = { ...migaja };
  if (migaja.data) {
    const datos = { ...migaja.data };
    for (const clave of ['url', 'from', 'to']) {
      if (typeof datos[clave] === 'string') datos[clave] = sinConsulta(datos[clave]);
    }
    limpia.data = datos;
  }
  if (migaja.category === 'navigation' && migaja.message) limpia.message = sinConsulta(migaja.message);
  return limpia;
}

/** El evento sin datos del pedido que puedan llevar contenido del usuario. */
export function filtrarEvento(evento: ErrorEvent): ErrorEvent | null {
  if (evento.request) {
    const { url, method } = evento.request;
    evento.request = {};
    if (url) evento.request.url = sinConsulta(url);
    if (method) evento.request.method = method;
  }
  delete evento.user;
  return evento;
}

export function opcionesComunes(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? 'local',
    sendDefaultPii: false,
    beforeBreadcrumb: filtrarMigaja,
    beforeSend: filtrarEvento,
  };
}
