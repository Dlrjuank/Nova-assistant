import { exigirSesion } from '@/lib/auth/sesion';
import { borrarSuscripcion, clavePublicaPush, contarSuscripciones, guardarSuscripcion } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaQuitarSuscripcion, esquemaSuscripcion } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E11c: la clave pública para suscribirse y cuántos dispositivos del usuario tienen notificaciones. */
export const GET = conManejoDeErrores(async () => {
  const sesion = await exigirSesion();
  return responderOk({ clavePublica: clavePublicaPush(), suscripciones: await contarSuscripciones(sesion.id) });
});

/** E11c (RB-45): guarda la suscripción de este dispositivo, después de que el usuario tocó "Activar notificaciones". */
export const POST = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  const datos = await leerCuerpo(peticion, esquemaSuscripcion);
  return responderOk(await guardarSuscripcion(sesion.id, datos), 201);
});

/** E11c: deja de enviar a este dispositivo. */
export const DELETE = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  const { endpoint } = await leerCuerpo(peticion, esquemaQuitarSuscripcion);
  return responderOk(await borrarSuscripcion(sesion.id, endpoint));
});
