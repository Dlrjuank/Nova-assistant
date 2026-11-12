import { exigirSesion } from '@/lib/auth/sesion';
import { responderPregunta } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaIdCuestionario, esquemaResponderPregunta } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E10e (RB-51): responde una pregunta del intento; devuelve si acertó, la correcta, la explicación y la cita. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdCuestionario.parse((await params).id);
  const { preguntaId, elegida } = await leerCuerpo(peticion, esquemaResponderPregunta);
  return responderOk(await responderPregunta(sesion.id, id, preguntaId, elegida));
});
