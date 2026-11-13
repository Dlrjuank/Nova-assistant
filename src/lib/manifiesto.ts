import type { MetadataRoute } from 'next';
import { COLOR_FONDO } from '@/lib/tema';

/**
 * E11b (PLAN_AMPLIACION 5.10): Nova se puede agregar a inicio como una app. Íconos provisionales; los finales
 * llegan con el diseño de E20b. Colores de los tokens del modo claro (globals.css).
 * Se sirve en /manifest.webmanifest con una ruta propia (no con app/manifest.ts) para enlazarlo con
 * crossorigin="use-credentials": en la vista previa protegida por Vercel, sin eso se pediría sin sesión.
 */
export function manifiesto(): MetadataRoute.Manifest {
  return {
    id: '/nova',
    name: 'Nova',
    short_name: 'Nova',
    description: 'Tus tareas, tus documentos y tu asistente de estudio.',
    lang: 'es',
    start_url: '/nova',
    scope: '/',
    display: 'standalone',
    // Pantalla de arranque en Android: el fondo de Nova (el manifiesto no distingue claro y oscuro). En el
    // iPhone la ponen las imágenes de src/lib/arranque.ts. La barra toma el fondo, como en la app (theme-color).
    background_color: COLOR_FONDO.claro,
    theme_color: COLOR_FONDO.claro,
    icons: [
      { src: '/icons/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
