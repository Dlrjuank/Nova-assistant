import { exigirSesion } from '@/lib/auth/sesion';
import { capitulosDeDocumento } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdDocumento } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E10b (RB-37): capítulos de un documento del usuario, con sus páginas. */
export const GET = conManejoDeErrores(async (_peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdDocumento.parse((await params).id);
  return responderOk(await capitulosDeDocumento(sesion.id, id));
});
