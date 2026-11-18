import { exigirSesion } from '@/lib/auth/sesion';
import { generarPlan } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdSemestre } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // embeddings y hasta dos llamadas a Gemini (9.3: un reintento)

type Contexto = { params: Promise<{ id: string }> };

/** E18 (9.2, 9.3; RB-19, RB-20, RB-22): genera una versión nueva del plan con el asistente. */
export const POST = conManejoDeErrores(async (_peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  return responderOk(await generarPlan(sesion.id, esquemaIdSemestre.parse((await params).id)), 201);
});
