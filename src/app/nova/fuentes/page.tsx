import { BuscadorWeb } from '@/components/nova/BuscadorWeb';
import { FuentesGuardadas } from '@/components/nova/FuentesGuardadas';
import { IndexacionPendiente } from '@/components/nova/IndexacionPendiente';
import { SubidorPdf } from '@/components/nova/SubidorPdf';
import { TablaDocumentos } from '@/components/nova/TablaDocumentos';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { exigirSesion, listarDocumentos, listarFuentesWeb } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

const SUBTITULO_PDF = 'Los PDF que el asistente usa para responder.';
const SUBTITULO_WEB =
  'Busca en Wikipedia en español: Nova resume los 3 primeros artículos y guarda la fuente. La consulta se envía a Wikipedia y, con los extractos, al proveedor del asistente.';

/** E10 (PLAN_AMPLIACION 5.5): Documentos y Web en una sola sección. `?pestana=web`; cualquier otro valor, PDF. */
export default async function FuentesPage({ searchParams }: { searchParams: Promise<{ pestana?: string | string[] }> }) {
  const { pestana } = await searchParams;
  const esWeb = pestana === 'web';

  return (
    <>
      <EncabezadoPantalla titulo="Fuentes" subtitulo={esWeb ? SUBTITULO_WEB : SUBTITULO_PDF} />
      <Pestanas
        etiqueta="Tipo de fuente"
        pestanas={[
          { href: '/nova/fuentes?pestana=pdf', texto: 'Subir PDF', activa: !esWeb },
          { href: '/nova/fuentes?pestana=web', texto: 'Buscar en la web', activa: esWeb },
        ]}
      />
      {esWeb ? <PestanaWeb /> : <PestanaPdf />}
    </>
  );
}

async function PestanaWeb() {
  const { id } = await exigirSesion();
  const fuentes = await listarFuentesWeb(id); // E10b2 (RB-54)
  return (
    <>
      <BuscadorWeb />
      <FuentesGuardadas fuentes={fuentes} />
    </>
  );
}

async function PestanaPdf() {
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus documentos (RB-01).
  const { id } = await exigirSesion();
  const documentos = await listarDocumentos(id);
  const pendientes = documentos.flatMap((d) => (d.progreso == null ? [] : [{ id: d.id, nombreArchivo: d.nombreArchivo, progreso: d.progreso }]));

  return (
    <>
      <Tarjeta className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-texto">Indexar PDF</h2>
          <p className="text-sm text-texto-suave">Solo se admiten PDF con texto seleccionable (no escaneados), de hasta 15 MB y 800 páginas.</p>
        </div>
        <SubidorPdf />
      </Tarjeta>

      <IndexacionPendiente pendientes={pendientes} />

      <section aria-labelledby="titulo-documentos" className="flex flex-col gap-3">
        <h2 id="titulo-documentos" className="text-base font-semibold text-texto">
          Tus documentos
        </h2>
        {documentos.length === 0 ? (
          <EstadoVacio titulo="Aún no hay documentos" descripcion="Indexa un PDF para poder preguntarle al asistente." />
        ) : (
          <TablaDocumentos documentos={documentos} />
        )}
      </section>
    </>
  );
}
