import Link from 'next/link';
import { Chat } from '@/components/nova/Chat';
import { Aviso } from '@/components/ui/Aviso';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { conversacionActual, exigirSesion, existenDocumentos, hayTareasPendientes, listarDocumentos } from '@/lib/dataService';
import { AVISO_PROVEEDOR, AVISO_SIN_FUENTES, AVISO_SOLO_TAREAS, avisoAsistente } from '@/lib/reglas/consulta';

export const dynamic = 'force-dynamic';

/** E03: el chat vive en /nova/asistente. ?pregunta= llega desde "Pregúntale a Nova" (Inicio) y se envía al cargar. */
export default async function AsistentePage({ searchParams }: { searchParams: Promise<{ pregunta?: string | string[] }> }) {
  const { pregunta } = await searchParams;
  const preguntaInicial = typeof pregunta === 'string' ? pregunta : undefined;
  // El layout ya exige sesión con acceso; aquí hace falta el id para el historial (RN-20) y sus documentos (RB-01).
  const { id } = await exigirSesion();
  const [hayDocumentos, hayTareas, conversacion, documentos] = await Promise.all([
    existenDocumentos(id),
    hayTareasPendientes(id),
    conversacionActual(id),
    listarDocumentos(id),
  ]);
  const aviso = avisoAsistente(hayDocumentos, hayTareas); // RB-30
  const enlaceIndexar = (
    <Link href="/nova/fuentes?pestana=pdf" className="font-semibold text-acento underline">
      Indexar un PDF
    </Link>
  );

  return (
    <>
      {/* B-46: el aviso del proveedor va solo donde se le pregunta a Nova. */}
      <Aviso tipo="info">{AVISO_PROVEEDOR}</Aviso>
      <EncabezadoPantalla titulo="Asistente" subtitulo="Pregunta sobre tus documentos y tus tareas pendientes; Nova cita de dónde sale cada dato." />
      {aviso === 'sin-fuentes' && (
        <Aviso tipo="info">
          {AVISO_SIN_FUENTES} {enlaceIndexar}
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
        documentos={documentos.filter((d) => d.progreso === null && d.numFragmentos > 0).map((d) => ({ id: d.id, nombre: d.nombreArchivo }))}
        {...(preguntaInicial ? { preguntaInicial } : {})}
      />
    </>
  );
}
