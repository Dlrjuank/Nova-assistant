import { exigirSesion } from '@/lib/auth/sesion';
import { cambiarFallas, guardarFallas } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaCambioFallas, esquemaFallas, esquemaIdSemestre } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** E14 (RB-15): el límite y las fallas registradas, escritos a mano. */
export const PATCH = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  return responderOk(await guardarFallas(sesion.id, id, await leerCuerpo(peticion, esquemaFallas)));
});

/** E14: los botones +1 y −1. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  const { cambio } = await leerCuerpo(peticion, esquemaCambioFallas);
  return responderOk(await cambiarFallas(sesion.id, id, cambio));
});
