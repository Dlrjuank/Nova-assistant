import { exigirSesion } from '@/lib/auth/sesion';
import { editarTema, eliminarTema } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaEditarTema, esquemaIdTema } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** E17: cambiar el nombre o confirmar un propuesto. */
export const PATCH = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdTema.parse((await params).id);
  return responderOk(await editarTema(sesion.id, id, await leerCuerpo(peticion, esquemaEditarTema)));
});

/** E17: eliminar un tema o descartar un propuesto. */
export const DELETE = conManejoDeErrores(async (_peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  return responderOk(await eliminarTema(sesion.id, esquemaIdTema.parse((await params).id)));
});
