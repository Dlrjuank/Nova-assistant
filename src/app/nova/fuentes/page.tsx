import Link from 'next/link';
import { FuentesGuardadas } from '@/components/nova/FuentesGuardadas';
import { IndexacionPendiente } from '@/components/nova/IndexacionPendiente';
import { SubidorPdf } from '@/components/nova/SubidorPdf';
import { TablaDocumentos } from '@/components/nova/TablaDocumentos';
import { claseBoton } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { exigirSesion, listarDocumentos, listarFuentesWeb, nombresMaterias } from '@/lib/dataService';
import { esTipoDocumento, NOMBRE_TIPO, TIPOS_DOCUMENTO, type TipoDocumento } from '@/lib/reglas/tiposDocumento';

export const dynamic = 'force-dynamic';

const SUBTITULO_PDF = 'Los documentos que el asistente usa para responder.';
const SUBTITULO_WEB = 'Las fuentes de Wikipedia que guardaste desde el Asistente. Las puedes consultar eligiendo «Fuentes web» en «Buscar en».';

/** E10 y E10c2 (PLAN_AMPLIACION 5.5): Subir PDF y Fuentes guardadas. `?pestana=web`; cualquier otro valor, PDF. */
export default async function FuentesPage({ searchParams }: { searchParams: Promise<{ pestana?: string | string[]; tipo?: string | string[] }> }) {
  const { pestana, tipo } = await searchParams;
  const esWeb = pestana === 'web';

  return (
    <>
      <EncabezadoPantalla titulo="Fuentes" subtitulo={esWeb ? SUBTITULO_WEB : SUBTITULO_PDF} />
      <Pestanas
        etiqueta="Tipo de fuente"
        pestanas={[
          { href: '/nova/fuentes?pestana=pdf', texto: 'Documentos', activa: !esWeb },
          { href: '/nova/fuentes?pestana=web', texto: 'Fuentes guardadas', activa: esWeb },
        ]}
      />
      {esWeb ? <PestanaWeb /> : <PestanaPdf tipo={esTipoDocumento(tipo) ? tipo : null} />}
    </>
  );
}

async function PestanaWeb() {
  const { id } = await exigirSesion();
  const fuentes = await listarFuentesWeb(id); // E10b2 (RB-54)
  return <FuentesGuardadas fuentes={fuentes} />;
}

/** E20d: `tipo` filtra la lista con la fila de píldoras (solo los tipos que hay). */
async function PestanaPdf({ tipo }: { tipo: TipoDocumento | null }) {
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus documentos (RB-01).
  const { id } = await exigirSesion();
  const [documentos, materias] = await Promise.all([listarDocumentos(id), nombresMaterias(id)]);
  const tipos = TIPOS_DOCUMENTO.filter((t) => documentos.some((d) => d.tipo === t));
  const elegido = tipo && tipos.includes(tipo) ? tipo : null;
  const visibles = elegido ? documentos.filter((d) => d.tipo === elegido) : documentos;
  const pendientes = documentos.flatMap((d) => (d.progreso == null ? [] : [{ id: d.id, nombreArchivo: d.nombreArchivo, progreso: d.progreso, ocr: d.ocr ?? null }]));

  return (
    <>
      <Tarjeta className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-texto">Indexar un documento</h2>
          <p className="text-sm text-texto-suave">PDF (también escaneados), Word (.docx), PowerPoint (.pptx), Markdown (.md), texto (.txt) o fotos (.jpg, .png), de hasta 15 MB. Las páginas escaneadas y las fotos se leen con OCR: antes de gastar consultas, Nova te pregunta.</p>
        </div>
        <SubidorPdf materias={materias} />
      </Tarjeta>

      <IndexacionPendiente pendientes={pendientes} />

      <section aria-labelledby="titulo-documentos" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-documentos" className="text-base font-semibold text-texto">
            Tus documentos
          </h2>
          {/* E10f: volver a abrir los cuestionarios ya creados (pedido del usuario). */}
          {documentos.length > 0 && (
            <Link href="/nova/cuestionarios" className={`${claseBoton('secundario')} min-h-10`}>
              Mis cuestionarios
            </Link>
          )}
        </div>
        {tipos.length > 1 && (
          <Pestanas
            etiqueta="Filtrar por tipo"
            pestanas={[
              { href: '/nova/fuentes?pestana=pdf', texto: 'Todos', activa: elegido === null },
              ...tipos.map((t) => ({ href: `/nova/fuentes?pestana=pdf&tipo=${t}`, texto: NOMBRE_TIPO[t], activa: elegido === t })),
            ]}
          />
        )}
        {documentos.length === 0 ? (
          <EstadoVacio titulo="Aún no hay documentos" descripcion="Indexa un documento para poder preguntarle al asistente." />
        ) : (
          <TablaDocumentos documentos={visibles} />
        )}
      </section>
    </>
  );
}
