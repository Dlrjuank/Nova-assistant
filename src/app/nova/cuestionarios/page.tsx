import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { HistorialCuestionarios } from '@/components/nova/cuestionarios/HistorialCuestionarios';
import { claseBoton, CLASE_FOCO } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { exigirSesion, listarCuestionarios } from '@/lib/dataService';
import { esquemaIdDocumento } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** E10f (5.11): historial de cuestionarios. `?documento=` muestra solo los de ese documento (desde "Ver capítulos"). */
export default async function CuestionariosPage({ searchParams }: { searchParams: Promise<{ documento?: string | string[] }> }) {
  const parametros = await searchParams;
  const sesion = await exigirSesion();
  const filtro = esquemaIdDocumento.safeParse(uno(parametros.documento));
  const documentoId = filtro.success ? filtro.data : undefined;
  // Uno ajeno o inexistente simplemente no trae nada (RB-01).
  const documentos = await listarCuestionarios(sesion.id, documentoId);
  const unico = documentoId ? documentos[0] : undefined;

  return (
    <>
      <EncabezadoPantalla titulo="Cuestionarios" subtitulo="Tus intentos por documento y capítulo, y si mejoraste." />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href={documentoId ? `/nova/fuentes/${documentoId}/capitulos` : '/nova/fuentes?pestana=pdf'}
          className={`inline-flex items-center gap-1 rounded text-sm font-medium text-acento ${CLASE_FOCO}`}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {documentoId ? 'Capítulos' : 'Fuentes'}
        </Link>
        {documentoId && (
          <Link href="/nova/cuestionarios" className={`rounded text-sm font-medium text-acento underline ${CLASE_FOCO}`}>
            Ver los de todos los documentos
          </Link>
        )}
      </div>
      {documentos.length === 0 ? (
        <EstadoVacio
          titulo={documentoId ? 'Este documento aún no tiene cuestionarios' : 'Aún no tienes cuestionarios'}
          descripcion="Créalos desde Fuentes o desde «Ver capítulos» de un documento."
          accion={
            <Link
              href={documentoId ? `/nova/cuestionarios/nuevo?documento=${documentoId}` : '/nova/fuentes?pestana=pdf'}
              className={claseBoton('primario')}
            >
              {documentoId ? 'Crear cuestionario' : 'Ir a Fuentes'}
            </Link>
          }
        />
      ) : (
        <HistorialCuestionarios documentos={unico ? [unico] : documentos} />
      )}
    </>
  );
}
