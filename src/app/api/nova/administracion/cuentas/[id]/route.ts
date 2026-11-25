import { accionSobreCuenta, eliminarCuenta, exigirAdministrador } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaAccionCuenta, esquemaEliminarCuenta, esquemaIdCuenta } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** E20c-2 (RB-82, RB-92, RB-93): habilitar, bloquear, desbloquear, niveles y el permiso de la clave del proyecto. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirAdministrador();
  const id = esquemaIdCuenta.parse((await params).id);
  const { accion } = await leerCuerpo(peticion, esquemaAccionCuenta);
  return responderOk(await accionSobreCuenta(sesion, id, accion));
});

/** RB-84 (solo el dueño): eliminar la cuenta y todos sus datos, con su correo escrito como confirmación. */
export const DELETE = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirAdministrador();
  const id = esquemaIdCuenta.parse((await params).id);
  const { correo } = await leerCuerpo(peticion, esquemaEliminarCuenta);
  return responderOk(await eliminarCuenta(sesion, id, correo));
});
