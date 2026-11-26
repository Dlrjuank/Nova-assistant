// Sentry en el navegador: solo errores, sin trazas ni grabación de sesión. Se carga cuando la página ya está lista
// (en un trozo aparte), para no sumar sus ~66 kB a la primera carga de cada pantalla (E20b, commit 11). Un error
// en el primer segundo, antes de que cargue, no se avisa: es el precio de no frenar la entrada.
import { opcionesComunes } from '@/lib/sentry/opciones';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

function iniciarSentry() {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({ ...opcionesComunes(dsn), tracesSampleRate: 0 });
  });
}

if (dsn && typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) window.requestIdleCallback(iniciarSentry, { timeout: 4000 });
  else setTimeout(iniciarSentry, 1500);
}
