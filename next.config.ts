import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
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

export default nextConfig;
