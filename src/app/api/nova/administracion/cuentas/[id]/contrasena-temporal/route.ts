import { darContrasenaTemporal, exigirAdministrador } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdCuenta } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/**
 * E20c-3 (RB-91): una contraseña temporal para un usuario activo (administradores y el dueño). La respuesta la trae
 * una sola vez y no se guarda en ningún lado; `responderOk` responde con `Cache-Control: no-store`.
 */
export const POST = conManejoDeErrores(async (_peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirAdministrador();
  const id = esquemaIdCuenta.parse((await params).id);
  return responderOk(await darContrasenaTemporal(sesion, id));
});
