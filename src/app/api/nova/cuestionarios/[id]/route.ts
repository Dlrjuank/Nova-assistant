import { exigirSesion } from '@/lib/auth/sesion';
import { obtenerCuestionario } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdCuestionario } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E10e (RB-50): las preguntas del intento actual, sin la respuesta correcta de las que faltan. */
export const GET = conManejoDeErrores(async (_peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdCuestionario.parse((await params).id);
  return responderOk(await obtenerCuestionario(sesion.id, id));
});
