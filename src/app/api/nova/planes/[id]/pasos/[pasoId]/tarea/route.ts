import { exigirSesion } from '@/lib/auth/sesion';
import { pasarPasoATarea } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdSemestre } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string; pasoId: string }> };

/** E19 (9.5, RB-24): pasa un paso del plan vigente a Tareas, una sola vez. */
export const POST = conManejoDeErrores(async (_peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const { id, pasoId } = await params;
  return responderOk(await pasarPasoATarea(sesion.id, esquemaIdSemestre.parse(id), esquemaIdSemestre.parse(pasoId)), 201);
});
