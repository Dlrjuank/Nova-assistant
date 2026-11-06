import Link from 'next/link';
import { TablaDocumentos } from '@/components/nova/TablaDocumentos';
import { claseBoton } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { exigirSesion, listarDocumentos } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export default async function DocumentosPage() {
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus documentos (RB-01).
  const { id } = await exigirSesion();
  const documentos = await listarDocumentos(id);

  return (
    <>
      <EncabezadoPantalla
        titulo="Documentos"
        subtitulo="Los PDF que el asistente usa para responder."
        accion={
          <Link href="/nova/documentos/nuevo" className={claseBoton('primario')}>
            Indexar PDF
          </Link>
        }
      />

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
