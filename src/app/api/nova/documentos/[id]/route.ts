import { exigirSesion } from '@/lib/auth/sesion';
import { eliminarDocumento } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdDocumento } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

export const DELETE = conManejoDeErrores(async (_peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdDocumento.parse((await params).id);
  await eliminarDocumento(sesion.id, id);
  return responderOk({ id });
});
