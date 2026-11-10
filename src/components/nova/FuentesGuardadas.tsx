import Link from 'next/link';
import { EliminarConConfirmacion } from '@/components/nova/EliminarConConfirmacion';
import type { FuenteWeb } from '@/lib/dataService';
import { MAX_FUENTES_WEB_POR_CATEGORIA } from '@/lib/config/nova';
import { formatearFecha } from '@/lib/formato';
import { agruparFuentes, tituloDeArticulo } from '@/lib/reglas/fuentesWeb';

/** E10b2 (RB-54): las fuentes web guardadas, por categoría, con su cupo y para eliminarlas. */
export function FuentesGuardadas({ fuentes }: { fuentes: FuenteWeb[] }) {
  return (
    <section aria-labelledby="titulo-fuentes-web" className="flex flex-col gap-3">
      <h2 id="titulo-fuentes-web" className="text-base font-semibold text-texto">
        Fuentes guardadas
      </h2>
      {fuentes.length === 0 ? (
        <p className="text-sm text-texto-suave">
          Aún no has guardado fuentes. En el{' '}
          <Link href="/nova/asistente" className="font-semibold text-acento underline">
            Asistente
          </Link>
          , elige «Wikipedia» en «Buscar en», pregunta y toca «Guardar fuente».
        </p>
      ) : (
        agruparFuentes(fuentes).map((grupo) => (
          <div key={grupo.categoria} className="flex flex-col gap-2">
            <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-texto">
              <span className="truncate" title={grupo.categoria}>
                {grupo.categoria}
              </span>
              <span aria-hidden="true" className="shrink-0 rounded-full bg-superficie-2 px-2 py-0.5 text-xs tabular-nums text-texto-suave">
                {grupo.fuentes.length}/{MAX_FUENTES_WEB_POR_CATEGORIA}
              </span>
              <span className="sr-only">
                , {grupo.fuentes.length} de {MAX_FUENTES_WEB_POR_CATEGORIA} fuentes
              </span>
            </h3>
            <ul className="flex flex-col gap-2">
              {grupo.fuentes.map((f) => {
                const titulo = tituloDeArticulo(f.url);
                return (
                  <li key={f.id} className="flex flex-col gap-2 rounded-xl border border-borde bg-superficie p-4">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-medium break-words text-acento underline">
                      {titulo}
                    </a>
                    <p className="line-clamp-3 text-sm text-texto-suave">{f.extracto}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-texto-suave">Guardada el {formatearFecha(f.fechaGuardado)}</span>
                      <EliminarConConfirmacion
                        ruta={`/api/nova/web/fuentes/${f.id}`}
                        etiqueta={`Eliminar fuente: ${titulo}`}
                        pregunta="¿Eliminar esta fuente? Se libera su cupo en la categoría. No se puede deshacer."
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
