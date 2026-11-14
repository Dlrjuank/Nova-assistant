import { exigirSesion } from '@/lib/auth/sesion';
import { crearNota } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaIdSemestre, esquemaNota } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** RB-09: una nota del componente; vacía queda "sin nota" (pendiente). */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  return responderOk(await crearNota(sesion.id, id, await leerCuerpo(peticion, esquemaNota)), 201);
});
