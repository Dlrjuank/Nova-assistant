import { exigirSesion } from '@/lib/auth/sesion';
import { vistaPreviaPlanLectura } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaIdDocumento, esquemaPlanLectura } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E10d (RB-42): vista previa del plan de lectura; no crea nada. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdDocumento.parse((await params).id);
  const datos = await leerCuerpo(peticion, esquemaPlanLectura);
  return responderOk(await vistaPreviaPlanLectura(sesion.id, id, datos));
});
