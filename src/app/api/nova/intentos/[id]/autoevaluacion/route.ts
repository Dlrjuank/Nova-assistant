import { exigirSesion } from '@/lib/auth/sesion';
import { autoevaluarPregunta } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaAutoevaluacion, esquemaIdCuestionario } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E10g (RB-68): calificarse una pregunta abierta ya enviada: `bien`, `medias` o `mal`, una sola vez. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdCuestionario.parse((await params).id);
  const { preguntaId, calificacion } = await leerCuerpo(peticion, esquemaAutoevaluacion);
  return responderOk(await autoevaluarPregunta(sesion.id, id, preguntaId, calificacion));
});
