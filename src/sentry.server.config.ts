// Sentry en el servidor (funciones de Vercel): errores y una muestra del 10 % de los tiempos de respuesta.
import * as Sentry from '@sentry/nextjs';
import { opcionesComunes } from '@/lib/sentry/opciones';

Sentry.init({
  ...opcionesComunes(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
});
