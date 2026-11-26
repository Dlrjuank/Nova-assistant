import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Solo en las funciones del servidor. El middleware (edge) queda sin Sentry para no sumarle peso: corre en cada
  // pedido. Sus errores se ven como 500 en los registros de Vercel.
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
}

// Errores de componentes de servidor y de rutas de la API que no los atrapan.
export const onRequestError = Sentry.captureRequestError;
