import { exigirSesion } from '@/lib/auth/sesion';
import { continuarIndexacion } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdDocumento } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
// E10b (RB-38): cada llamada indexa la parte que quepa antes de este límite.
export const maxDuration = 300;

export const POST = conManejoDeErrores(async (_peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdDocumento.parse((await params).id);
  return responderOk(await continuarIndexacion(sesion.id, id));
});
