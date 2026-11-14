import { exigirSesion } from '@/lib/auth/sesion';
import { editarComponente, eliminarComponente } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaEditarComponente, esquemaIdSemestre } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  return responderOk(await editarComponente(sesion.id, id, await leerCuerpo(peticion, esquemaEditarComponente)));
});

/** Borra el componente con sus notas; la interfaz pide confirmación antes. */
export const DELETE = conManejoDeErrores(async (_peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  return responderOk(await eliminarComponente(sesion.id, esquemaIdSemestre.parse((await params).id)));
});
