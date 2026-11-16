import { exigirSesion } from '@/lib/auth/sesion';
import { crearTema } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaCrearTema, esquemaIdSemestre } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** E17 (6.8): un tema escrito a mano, que nace confirmado. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  const { nombre } = await leerCuerpo(peticion, esquemaCrearTema);
  return responderOk(await crearTema(sesion.id, id, nombre), 201);
});
