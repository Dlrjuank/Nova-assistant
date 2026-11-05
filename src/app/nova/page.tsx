import Link from 'next/link';
import { Chat } from '@/components/nova/Chat';
import { Aviso } from '@/components/ui/Aviso';
import { conversacionActual, existenDocumentos, obtenerSesion } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export default async function AsistentePage() {
  // El layout ya exige sesión con acceso; aquí solo hace falta el id para leer el historial (RN-20).
  const [hayDocumentos, sesion] = await Promise.all([existenDocumentos(), obtenerSesion()]);
  const conversacion = sesion ? await conversacionActual(sesion.id) : null;

  return (
    <>
      <h1 className="text-2xl font-bold">Asistente</h1>
      {!hayDocumentos && (
        <Aviso tipo="advertencia">
          Aún no hay documentos indexados. Indexa un PDF antes de preguntar.{' '}
          <Link href="/nova/documentos/nuevo" className="font-semibold text-primario underline">
            Indexar un PDF
          </Link>
        </Aviso>
      )}
      <Chat conversacionId={conversacion?.id ?? null} historial={conversacion?.mensajes ?? []} />
    </>
  );
}
