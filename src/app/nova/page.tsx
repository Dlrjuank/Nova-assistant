import Link from 'next/link';
import { Chat } from '@/components/nova/Chat';
import { Aviso } from '@/components/ui/Aviso';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { conversacionActual, exigirSesion, existenDocumentos } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export default async function AsistentePage() {
  // El layout ya exige sesión con acceso; aquí hace falta el id para el historial (RN-20) y sus documentos (RB-01).
  const { id } = await exigirSesion();
  const [hayDocumentos, conversacion] = await Promise.all([existenDocumentos(id), conversacionActual(id)]);

  return (
    <>
      <EncabezadoPantalla titulo="Asistente" subtitulo="Pregunta sobre tus documentos y tus tareas pendientes; Nova cita de dónde sale cada dato." />
      {!hayDocumentos && (
        <Aviso tipo="advertencia">
          Aún no hay documentos indexados. Indexa un PDF antes de preguntar.{' '}
          <Link href="/nova/documentos/nuevo" className="font-semibold text-acento underline">
            Indexar un PDF
          </Link>
        </Aviso>
      )}
      <Chat conversacionId={conversacion?.id ?? null} historial={conversacion?.mensajes ?? []} />
    </>
  );
}
