import { exigirSesion } from '@/lib/auth/sesion';
import { enviarPrueba } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';

export const dynamic = 'force-dynamic';

/** E11c (B-56): "Enviar una de prueba" a todos los dispositivos del usuario. */
export const POST = conManejoDeErrores(async () => {
  const sesion = await exigirSesion();
  return responderOk(await enviarPrueba(sesion.id));
});
