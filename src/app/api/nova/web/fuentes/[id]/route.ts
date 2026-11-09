import { exigirSesion } from '@/lib/auth/sesion';
import { eliminarFuenteWeb } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdDocumento } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E10b2 (RB-54): una fuente de otro usuario responde como inexistente. */
export const DELETE = conManejoDeErrores(async (_peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdDocumento.parse((await params).id);
  await eliminarFuenteWeb(sesion.id, id);
  return responderOk({ id });
});
