import { exigirSesion } from '@/lib/auth/sesion';
import { consultarYRegistrar, explicarRespuesta } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaConsulta } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
// Un embedding y una respuesta de Gemini, con reintentos y modelo de respaldo.
export const maxDuration = 60;

export const POST = conManejoDeErrores(async (peticion: Request) => {
  const { id } = await exigirSesion();
  const { pregunta, conversacionId, documentoId, explicar } = await leerCuerpo(peticion, esquemaConsulta);
  if (explicar) return responderOk(await explicarRespuesta(id, explicar.mensajeId, explicar.modo)); // RB-41
  return responderOk(await consultarYRegistrar(id, pregunta as string, conversacionId, documentoId));
});
