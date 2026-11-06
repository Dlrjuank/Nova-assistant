import { exigirSesion } from '@/lib/auth/sesion';
import { completarTarea } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaCompletar, esquemaIdTarea } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

export const POST = conManejoDeErrores(async (peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdTarea.parse((await params).id);
  const { minutos } = await leerCuerpo(peticion, esquemaCompletar);
  return responderOk(await completarTarea(sesion.id, id, minutos));
});
