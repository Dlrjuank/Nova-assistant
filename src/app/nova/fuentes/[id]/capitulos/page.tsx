import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { capitulosDeDocumento, exigirSesion, type CapitulosDocumento } from '@/lib/dataService';
import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';
import { citaDePaginas, MENSAJE_REINDEXAR, MENSAJE_SIN_CAPITULOS } from '@/lib/reglas/libros';
import { esquemaIdDocumento } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E10b (PLAN_AMPLIACION 5.9, RB-37): los capítulos de un documento, con sus páginas. */
export default async function CapitulosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirSesion();
  const idValido = esquemaIdDocumento.safeParse(id);
  let datos: CapitulosDocumento | null = null;
  if (idValido.success) {
    // Un documento de otro usuario se comporta como inexistente (RB-01).
    datos = await capitulosDeDocumento(sesion.id, idValido.data).catch((error: unknown) => {
      if (error instanceof ErrorDeNegocio && error.codigo === 'DOCUMENTO_NO_ENCONTRADO') return null;
      throw error;
    });
  }

  const volver = (
    <Link href="/nova/fuentes?pestana=pdf" className={`inline-flex items-center gap-1 self-start rounded text-sm font-medium text-acento ${CLASE_FOCO}`}>
      <ChevronLeft aria-hidden="true" className="size-4" />
      Fuentes
    </Link>
  );

  if (!datos) {
    return (
      <>
        <EncabezadoPantalla titulo="Capítulos" />
        {volver}
        <EstadoVacio titulo={MENSAJES.DOCUMENTO_NO_ENCONTRADO} descripcion="Puede que ya lo hayas eliminado." />
      </>
    );
  }

  const { documento, capitulos } = datos;
  const sinPaginas = documento.paginas === null;
  return (
    <>
      <EncabezadoPantalla titulo="Capítulos" subtitulo={<span className="break-all">{documento.nombreArchivo}{documento.paginas ? ` · ${documento.paginas} páginas` : ''}</span>} />
      {volver}
      {capitulos.length === 0 ? (
        <EstadoVacio titulo={sinPaginas ? MENSAJE_REINDEXAR : MENSAJE_SIN_CAPITULOS} />
      ) : (
        <Tarjeta className="max-w-3xl">
          <ol className="flex flex-col divide-y divide-borde">
            {capitulos.map((c) => (
              <li key={c.orden} className={`flex items-baseline justify-between gap-4 py-2.5 ${c.nivel === 2 ? 'pl-4' : ''}`}>
                <span className={`min-w-0 break-words ${c.nivel === 2 ? 'text-sm text-texto-suave' : 'font-medium text-texto'}`}>{c.titulo}</span>
                <span className="shrink-0 text-sm whitespace-nowrap text-texto-suave tabular-nums">{citaDePaginas(c.etiquetaPaginas)}</span>
              </li>
            ))}
          </ol>
        </Tarjeta>
      )}
    </>
  );
}
