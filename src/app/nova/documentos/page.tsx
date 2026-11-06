import Link from 'next/link';
import { TablaDocumentos } from '@/components/nova/TablaDocumentos';
import { claseBoton } from '@/components/ui/Boton';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { exigirSesion, listarDocumentos } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export default async function DocumentosPage() {
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus documentos (RB-01).
  const { id } = await exigirSesion();
  const documentos = await listarDocumentos(id);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Documentos</h1>
        <Link href="/nova/documentos/nuevo" className={claseBoton('primario')}>
          Indexar PDF
        </Link>
      </div>

      {documentos.length === 0 ? (
        <EstadoVacio
          titulo="Aún no hay documentos"
          descripcion="Indexa un PDF para poder preguntarle al asistente."
          accion={
            <Link href="/nova/documentos/nuevo" className={claseBoton('primario')}>
              Indexar PDF
            </Link>
          }
        />
      ) : (
        <TablaDocumentos documentos={documentos} />
      )}
    </>
  );
}
