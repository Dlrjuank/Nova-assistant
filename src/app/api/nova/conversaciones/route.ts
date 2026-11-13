import { exigirSesion } from '@/lib/auth/sesion';
import { borrarHistorial, conversacionActual, crearConversacion } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';

export const dynamic = 'force-dynamic';

/** La conversación más reciente de quien llama, o null (RN-20). */
export const GET = conManejoDeErrores(async () => {
  const { id } = await exigirSesion();
  return responderOk(await conversacionActual(id));
});

/** "Conversación nueva": las anteriores se conservan. */
export const POST = conManejoDeErrores(async () => {
  const { id } = await exigirSesion();
  return responderOk(await crearConversacion(id), 201);
});

/** E11 (RB-25): borra todo el historial con el asistente. La confirmación la pide la pantalla. */
export const DELETE = conManejoDeErrores(async () => {
  const { id } = await exigirSesion();
  return responderOk(await borrarHistorial(id));
});
