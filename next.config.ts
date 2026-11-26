import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // E20b (tiempo de carga): volver a una pantalla vista en los últimos 30 s la muestra al instante, sin pedirla otra
  // vez. Todo lo que cambia datos llama a router.refresh(), que vacía esta memoria: nunca se ve algo viejo después
  // de guardar.
  experimental: {
    staleTimes: { dynamic: 30 },
  },
  // E11b: el service worker y sus reglas se revisan en cada visita, para que una versión nueva llegue enseguida.
  async headers() {
    return ['/sw.js', '/sw-reglas.js'].map((source) => ({
      source,
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      ],
    }));
  },
  // E10 (PLAN_AMPLIACION 4.4): Documentos y Web ahora son pestañas de Fuentes.
  async redirects() {
    return [
      { source: '/nova/documentos', destination: '/nova/fuentes?pestana=pdf', permanent: true },
      { source: '/nova/documentos/nuevo', destination: '/nova/fuentes?pestana=pdf', permanent: true },
      { source: '/nova/web', destination: '/nova/fuentes?pestana=web', permanent: true },
    ];
  },
};

// Sentry (ajuste del 2026-11-26): errores del navegador, del servidor y del middleware. Con `SENTRY_AUTH_TOKEN`
// (solo en Vercel) sube los mapas de código para ver el archivo y la línea reales, y los borra del build: nunca se
// publican. Sin él (local), no los genera.
export default withSentryConfig(nextConfig, {
  org: 'juank-ing',
  project: 'nova-assistant',
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // El middleware corre en cada pedido: sin Sentry adentro pesa ~57 kB menos. Sus errores igual salen como 500
  // en los registros de Vercel.
  webpack: { autoInstrumentMiddleware: false },
});
