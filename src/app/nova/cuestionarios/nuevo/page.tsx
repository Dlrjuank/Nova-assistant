import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { FormularioCuestionario } from '@/components/nova/cuestionarios/FormularioCuestionario';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { capitulosDeDocumento, exigirSesion, type CapitulosDocumento } from '@/lib/dataService';
import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';
import { MENSAJE_REINDEXAR } from '@/lib/reglas/libros';
import { esquemaIdDocumento } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** E10e (5.11): "Crear cuestionario" desde Fuentes o desde "Ver capítulos". */
export default async function NuevoCuestionarioPage({ searchParams }: { searchParams: Promise<{ documento?: string | string[]; capitulo?: string | string[] }> }) {
  const parametros = await searchParams;
  const sesion = await exigirSesion();
  const id = esquemaIdDocumento.safeParse(uno(parametros.documento));
  let datos: CapitulosDocumento | null = null;
  if (id.success) {
    // Un documento de otro usuario se comporta como inexistente (RB-01).
    datos = await capitulosDeDocumento(sesion.id, id.data).catch((error: unknown) => {
      if (error instanceof ErrorDeNegocio && error.codigo === 'DOCUMENTO_NO_ENCONTRADO') return null;
      throw error;
    });
  }
  const capituloPedido = Number(uno(parametros.capitulo));

  return (
    <>
      <EncabezadoPantalla
        titulo="Crear cuestionario"
        subtitulo={datos ? <span className="break-all">{datos.documento.nombreArchivo}{datos.documento.paginas ? ` · ${datos.documento.paginas} páginas` : ''}</span> : undefined}
      />
      <Link
        href={datos ? `/nova/fuentes/${datos.documento.id}/capitulos` : '/nova/fuentes?pestana=pdf'}
        className={`inline-flex items-center gap-1 self-start rounded text-sm font-medium text-acento ${CLASE_FOCO}`}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {datos ? 'Capítulos' : 'Fuentes'}
      </Link>
      {!datos ? (
        <EstadoVacio titulo={MENSAJES.DOCUMENTO_NO_ENCONTRADO} descripcion="Puede que ya lo hayas eliminado." />
      ) : datos.documento.paginas === null ? (
        <EstadoVacio titulo={MENSAJE_REINDEXAR} />
      ) : (
        <Tarjeta className="max-w-2xl">
          <FormularioCuestionario
            documento={{ id: datos.documento.id, paginas: datos.documento.paginas }}
            capitulos={datos.capitulos}
            {...(Number.isInteger(capituloPedido) ? { capituloInicial: capituloPedido } : {})}
          />
        </Tarjeta>
      )}
    </>
  );
}
