import { exigirSesion } from '@/lib/auth/sesion';
import { eliminarTarea } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdTarea } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

export const DELETE = conManejoDeErrores(async (_peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  await exigirSesion();
  const id = esquemaIdTarea.parse((await params).id);
  await eliminarTarea(id);
  return responderOk({ id });
});
