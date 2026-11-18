import { exigirSesion } from '@/lib/auth/sesion';
import { restaurarVersion } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaIdSemestre, esquemaRestaurarPlan } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** E18 (9.4): copia una versión anterior como versión nueva. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  const { numero } = await leerCuerpo(peticion, esquemaRestaurarPlan);
  return responderOk(await restaurarVersion(sesion.id, id, numero), 201);
});
