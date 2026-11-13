import { exigirSesion } from '@/lib/auth/sesion';
import { actualizarConfiguracion, obtenerConfiguracion } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaConfiguracion } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E11 (5.8): perfil y preferencias de quien llama. */
export const GET = conManejoDeErrores(async () => {
  const sesion = await exigirSesion();
  return responderOk(await obtenerConfiguracion(sesion.id, sesion.email));
});

/** E11: cambia solo los campos que llegan (nombre, tema, formato de hora, nota para aprobar, redondeo, cortes). */
export const PATCH = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  const cambios = await leerCuerpo(peticion, esquemaConfiguracion);
  return responderOk(await actualizarConfiguracion(sesion.id, sesion.email, cambios));
});
