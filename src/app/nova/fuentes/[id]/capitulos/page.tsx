import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { claseBoton, CLASE_FOCO } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { PlanLectura } from '@/components/nova/PlanLectura';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { capitulosDeDocumento, exigirSesionDePagina, listarCategorias, textoDePaginas, type CapitulosDocumento } from '@/lib/dataService';
import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';
import { MENSAJE_FOTOS_SIN_CAPITULOS, MENSAJE_REINDEXAR, MENSAJE_SIN_CAPITULOS } from '@/lib/reglas/libros';
import { contarUnidades } from '@/lib/reglas/tiposDocumento';
import { SelloDocumento } from '@/components/nova/SelloDocumento';
import { esquemaIdDocumento } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/**
 * E10b (PLAN_AMPLIACION 5.9, RB-37): los capítulos de un documento, con sus páginas. E10d: plan de lectura (RB-42).
 * E20d: "Ver contenido": la estructura de cada tipo (capítulos y páginas, secciones, diapositivas o partes).
 */
export default async function CapitulosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirSesionDePagina();
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
        <EncabezadoPantalla titulo="Contenido" />
        {volver}
        <EstadoVacio titulo={MENSAJES.DOCUMENTO_NO_ENCONTRADO} descripcion="Puede que ya lo hayas eliminado." />
      </>
    );
  }

  const { documento, capitulos } = datos;
  const sinPaginas = documento.paginas === null;
  const categorias = capitulos.length > 0 ? await listarCategorias(sesion.id) : [];
  // Ajuste de E20d-4: las fotos no tienen capítulos; se muestra lo que se leyó en cada una.
  const esFoto = documento.tipo === 'imagen';
  // Si lo eliminaron entre una consulta y otra, se muestra como sin texto en vez de la página de error.
  const textos = esFoto && !sinPaginas ? await textoDePaginas(sesion.id, documento.id).catch(() => []) : [];
  return (
    <>
      <EncabezadoPantalla
        titulo="Contenido"
        subtitulo={
          <span className="inline-flex items-center gap-2 break-all">
            <SelloDocumento tipo={documento.tipo ?? 'pdf'} />
            {documento.nombreArchivo}
            {documento.paginas ? ` · ${contarUnidades(documento.paginas, documento.unidad ?? 'pagina')}` : ''}
          </span>
        }
      />
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
      {esFoto && textos.length > 0 ? (
        <section aria-label="Lo que Nova leyó en las fotos" className="flex flex-col gap-3">
          <p className="text-sm text-texto-suave">Lo que Nova leyó en {textos.length > 1 ? 'cada foto' : 'la foto'}. Pregúntale al Asistente por esto.</p>
          {textos.map(({ pagina, texto }) => (
            <article key={pagina} className="flex flex-col gap-2 rounded-[16px] border border-borde bg-superficie p-4">
              {textos.length > 1 && <h2 className="text-sm font-semibold text-texto">Foto {pagina}</h2>}
              {texto ? (
                // El texto se guarda en un solo renglón (RN-10): los saltos de línea de la foto no se conservan.
                <p className="text-sm leading-6 text-texto">{texto}</p>
              ) : (
                <p className="text-sm text-texto-suave">No encontré texto en esta foto.</p>
              )}
            </article>
          ))}
        </section>
      ) : capitulos.length === 0 ? (
        <EstadoVacio
          titulo={sinPaginas ? MENSAJE_REINDEXAR : documento.tipo === 'imagen' ? MENSAJE_FOTOS_SIN_CAPITULOS : MENSAJE_SIN_CAPITULOS}
        />
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
