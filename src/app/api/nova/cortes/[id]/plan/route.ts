import { exigirSesion } from '@/lib/auth/sesion';
import { obtenerPlan } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdSemestre, esquemaVersionPlan } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** E18 (9.4): el plan del corte (null si aún no tiene), con la versión vigente o la pedida en ?version=. */
export const GET = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  const pedida = new URL(peticion.url).searchParams.get('version');
  return responderOk(await obtenerPlan(sesion.id, id, pedida === null ? undefined : esquemaVersionPlan.parse(pedida)));
});
