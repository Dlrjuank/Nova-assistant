import Link from 'next/link';
import { Chat } from '@/components/nova/Chat';
import { Aviso } from '@/components/ui/Aviso';
import { existenDocumentos } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export default async function AsistentePage() {
  const hayDocumentos = await existenDocumentos();

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
      <Chat />
    </>
  );
}
