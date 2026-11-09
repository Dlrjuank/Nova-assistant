import { exigirSesion } from '@/lib/auth/sesion';
import { editarTarea, eliminarTarea } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaIdTarea, esquemaTarea } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E09 (RB-29): mismo esquema y mismas reglas que crear. */
export const PATCH = conManejoDeErrores(async (peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdTarea.parse((await params).id);
  const datos = await leerCuerpo(peticion, esquemaTarea);
  return responderOk(await editarTarea(sesion.id, id, datos));
});

export const DELETE = conManejoDeErrores(async (_peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdTarea.parse((await params).id);
  await eliminarTarea(sesion.id, id);
  return responderOk({ id });
});
