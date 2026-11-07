import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * E04 (PLAN_AMPLIACION 3.2): login, registro y recuperación con el estilo de Nova (tokens, claro y oscuro).
 * Solo cambia la presentación; la lógica y las rutas de cada formulario siguen igual.
 */
export function TarjetaAcceso({
  titulo,
  subtitulo,
  children,
  pie,
}: {
  titulo: string;
  subtitulo: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fondo px-4 py-10 text-texto sm:px-6">
      <section className="w-full max-w-md rounded-2xl border border-borde bg-superficie p-6 shadow-suave sm:p-9">
        <div className="mb-8">
          <p className="mb-8 inline-flex items-center gap-2 text-lg font-bold tracking-tight text-acento">
            <span className="flex size-9 items-center justify-center rounded-xl bg-acento text-acento-texto">
              <Sparkles aria-hidden="true" className="size-5" />
            </span>
            Nova
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-texto sm:text-3xl">{titulo}</h1>
          <p className="mt-2 text-sm leading-6 text-texto-suave">{subtitulo}</p>
        </div>
        {children}
        {pie && <div className="mt-7 text-center text-sm text-texto-suave">{pie}</div>}
      </section>
    </main>
  );
}

/** Campo de los formularios de acceso: 16 px de letra para que el teléfono no haga zoom al enfocarlo. */
export const CLASE_CAMPO_ACCESO =
  'min-h-11 w-full min-w-0 rounded-xl border bg-superficie px-4 py-2.5 text-base text-texto transition-colors duration-150 placeholder:text-texto-suave focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-acento';

export const CLASE_ETIQUETA_ACCESO = 'mb-2 block text-sm font-medium text-texto';

export const CLASE_ENLACE_ACCESO =
  'rounded font-medium text-acento underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento';

export const CLASE_ERROR_ACCESO = 'rounded-xl border border-peligro/40 bg-peligro/12 px-4 py-3 text-sm text-texto';

export const CLASE_EXITO_ACCESO = 'rounded-xl border border-exito/40 bg-exito/12 px-4 py-3 text-sm text-texto';

export const CLASE_ERROR_CAMPO = 'mt-2 text-sm text-peligro';
