import Link from 'next/link';
import { Chat } from '@/components/nova/Chat';
import { Aviso } from '@/components/ui/Aviso';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { conversacionActual, exigirSesion, existenDocumentos, hayTareasPendientes } from '@/lib/dataService';
import { AVISO_SOLO_TAREAS, avisoAsistente } from '@/lib/reglas/consulta';

export const dynamic = 'force-dynamic';

/** E03: el chat vive en /nova/asistente. ?pregunta= llega desde "Pregúntale a Nova" (Inicio) y se envía al cargar. */
export default async function AsistentePage({ searchParams }: { searchParams: Promise<{ pregunta?: string | string[] }> }) {
  const { pregunta } = await searchParams;
  const preguntaInicial = typeof pregunta === 'string' ? pregunta : undefined;
  // El layout ya exige sesión con acceso; aquí hace falta el id para el historial (RN-20) y sus documentos (RB-01).
  const { id } = await exigirSesion();
  const [hayDocumentos, hayTareas, conversacion] = await Promise.all([
    existenDocumentos(id),
    hayTareasPendientes(id),
    conversacionActual(id),
  ]);
  const aviso = avisoAsistente(hayDocumentos, hayTareas); // RB-30
  const enlaceIndexar = (
    <Link href="/nova/documentos/nuevo" className="font-semibold text-acento underline">
      Indexar un PDF
    </Link>
  );

  return (
    <>
      <EncabezadoPantalla titulo="Asistente" subtitulo="Pregunta sobre tus documentos y tus tareas pendientes; Nova cita de dónde sale cada dato." />
      {aviso === 'sin-fuentes' && (
        <Aviso tipo="advertencia">
          Aún no hay documentos indexados. Indexa un PDF antes de preguntar. {enlaceIndexar}
        </Aviso>
      )}
      {aviso === 'solo-tareas' && (
        <Aviso tipo="info">
          {AVISO_SOLO_TAREAS} {enlaceIndexar}
        </Aviso>
      )}
      <Chat
        conversacionId={conversacion?.id ?? null}
        historial={conversacion?.mensajes ?? []}
        {...(preguntaInicial ? { preguntaInicial } : {})}
      />
    </>
  );
}
