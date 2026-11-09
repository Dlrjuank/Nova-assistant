import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
