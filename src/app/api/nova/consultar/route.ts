import { exigirSesion } from '@/lib/auth/sesion';
import { consultar } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaConsulta } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
// Un embedding y una respuesta de Gemini, con reintentos y modelo de respaldo.
export const maxDuration = 60;

export const POST = conManejoDeErrores(async (peticion: Request) => {
  await exigirSesion();
  const { pregunta } = await leerCuerpo(peticion, esquemaConsulta);
  return responderOk(await consultar(pregunta));
});
