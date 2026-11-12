import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { claseBoton, CLASE_FOCO } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { PlanLectura } from '@/components/nova/PlanLectura';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { capitulosDeDocumento, exigirSesion, listarCategorias, type CapitulosDocumento } from '@/lib/dataService';
import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';
import { MENSAJE_REINDEXAR, MENSAJE_SIN_CAPITULOS } from '@/lib/reglas/libros';
import { esquemaIdDocumento } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E10b (PLAN_AMPLIACION 5.9, RB-37): los capítulos de un documento, con sus páginas. E10d: plan de lectura (RB-42). */
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
  const categorias = capitulos.length > 0 ? await listarCategorias(sesion.id) : [];
  return (
    <>
      <EncabezadoPantalla titulo="Capítulos" subtitulo={<span className="break-all">{documento.nombreArchivo}{documento.paginas ? ` · ${documento.paginas} páginas` : ''}</span>} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {volver}
        {!sinPaginas && (
          <div className="flex flex-wrap gap-2">
            {/* E10f: los cuestionarios de este documento (pedido del usuario). */}
            <Link href={`/nova/cuestionarios?documento=${documento.id}`} className={`${claseBoton('secundario')} min-h-10`}>
              Ver cuestionarios
            </Link>
            <Link href={`/nova/cuestionarios/nuevo?documento=${documento.id}`} className={`${claseBoton('secundario')} min-h-10`}>
              Crear cuestionario
            </Link>
          </div>
        )}
      </div>
      {capitulos.length === 0 ? (
        <EstadoVacio titulo={sinPaginas ? MENSAJE_REINDEXAR : MENSAJE_SIN_CAPITULOS} />
      ) : (
        <PlanLectura
          documentoId={documento.id}
          capitulos={capitulos}
          categoriaInicial={documento.categoria}
          categorias={categorias.map((c) => ({ nombre: c.nombre, color: c.color }))}
        />
      )}
    </>
  );
}
