import { exigirSesion } from '@/lib/auth/sesion';
import { editarNota, eliminarNota } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaIdSemestre, esquemaNota } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  return responderOk(await editarNota(sesion.id, id, await leerCuerpo(peticion, esquemaNota)));
});

export const DELETE = conManejoDeErrores(async (_peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  return responderOk(await eliminarNota(sesion.id, esquemaIdSemestre.parse((await params).id)));
});
