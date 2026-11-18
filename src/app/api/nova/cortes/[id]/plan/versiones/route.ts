import { exigirSesion } from '@/lib/auth/sesion';
import { guardarVersionManual } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaGuardarPlan, esquemaIdSemestre } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** E18 (9.4): guarda el plan editado como una versión manual. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  const { pasos } = await leerCuerpo(peticion, esquemaGuardarPlan);
  return responderOk(await guardarVersionManual(sesion.id, id, pasos), 201);
});
