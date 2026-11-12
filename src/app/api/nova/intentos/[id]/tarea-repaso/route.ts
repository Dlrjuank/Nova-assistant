import { exigirSesion } from '@/lib/auth/sesion';
import { crearTareaRepaso } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaIdCuestionario, esquemaTareaRepaso } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E10f (RB-53): crea la tarea de repaso de un capítulo, tras confirmarla en el diálogo. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdCuestionario.parse((await params).id);
  const datos = await leerCuerpo(peticion, esquemaTareaRepaso);
  return responderOk(await crearTareaRepaso(sesion.id, id, datos), 201);
});
