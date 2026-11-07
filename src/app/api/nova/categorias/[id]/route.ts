import { exigirSesion } from '@/lib/auth/sesion';
import { actualizarCategoria, eliminarCategoria } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaActualizarCategoria, esquemaIdCategoria } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** Renombrar (actualiza también las tareas) o cambiar el color (RB-02, RB-03). */
export const PATCH = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdCategoria.parse((await params).id);
  const datos = await leerCuerpo(peticion, esquemaActualizarCategoria);
  return responderOk(await actualizarCategoria(sesion.id, id, datos));
});

/** RB-04: sus tareas pasan a General; General no se elimina. La interfaz pide confirmación antes. */
export const DELETE = conManejoDeErrores(async (_peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdCategoria.parse((await params).id);
  return responderOk(await eliminarCategoria(sesion.id, id));
});
