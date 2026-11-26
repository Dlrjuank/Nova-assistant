'use client';

// Último recurso: un error que rompe hasta el layout raíz. Lo avisa a Sentry y ofrece recargar.
// Reemplaza al layout, así que trae sus propios estilos y su propio <html>.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import './globals.css';

export default function ErrorGlobal({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body data-nova-fondo className="flex min-h-screen items-center justify-center bg-fondo px-4 text-texto">
        <main className="flex max-w-sm flex-col items-center gap-4 text-center">
          <h1 className="text-xl font-bold">Algo salió mal</h1>
          <p className="text-sm text-texto-suave">Ya quedó anotado para revisarlo. Recarga la página para seguir.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-acento px-5 py-2 text-sm font-semibold text-acento-texto"
          >
            Recargar
          </button>
        </main>
      </body>
    </html>
  );
}
