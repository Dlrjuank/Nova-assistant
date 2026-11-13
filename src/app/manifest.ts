import type { MetadataRoute } from 'next';

/**
 * E11b (PLAN_AMPLIACION 5.10): Nova se puede agregar a inicio como una app. Íconos provisionales; los finales
 * llegan con el diseño de E20b. Colores de los tokens del modo claro (globals.css).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/nova',
    name: 'Nova',
    short_name: 'Nova',
    description: 'Tus tareas, tus documentos y tu asistente de estudio.',
    lang: 'es',
    start_url: '/nova',
    scope: '/',
    display: 'standalone',
    background_color: '#faf6f0',
    theme_color: '#b4471f',
    icons: [
      { src: '/icons/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
