import { cambiarTopes, exigirAdministrador, panelAdministracion } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaTopes } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E20c-2 (RB-83): todo el panel, solo para administradores; a cualquier otra cuenta, 403 sin ningún dato. */
export const GET = conManejoDeErrores(async () => {
  const sesion = await exigirAdministrador();
  return responderOk(await panelAdministracion(sesion));
});

/** RB-85, RB-88: cambiar los topes (solo el dueño). */
export const PATCH = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirAdministrador();
  const { cuentas, mb } = await leerCuerpo(peticion, esquemaTopes);
  return responderOk(await cambiarTopes(sesion, cuentas, mb));
});
