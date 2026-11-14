import { exigirSesion } from '@/lib/auth/sesion';
import { editarMateria, eliminarMateria, obtenerMateria } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaEditarMateria, esquemaIdSemestre } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

export const GET = conManejoDeErrores(async (_peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  return responderOk(await obtenerMateria(sesion.id, esquemaIdSemestre.parse((await params).id)));
});

/** RB-05, RB-06: nombre, créditos o docente. */
export const PATCH = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  return responderOk(await editarMateria(sesion.id, id, await leerCuerpo(peticion, esquemaEditarMateria)));
});

/** Borra la materia con sus cortes, componentes y notas; la interfaz pide confirmación antes. */
export const DELETE = conManejoDeErrores(async (_peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  return responderOk(await eliminarMateria(sesion.id, esquemaIdSemestre.parse((await params).id)));
});
