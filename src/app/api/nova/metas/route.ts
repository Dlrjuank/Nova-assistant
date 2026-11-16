import { exigirSesion } from '@/lib/auth/sesion';
import { crearMetaSemanal, listarMetasSemanales } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaCrearMetaSemanal } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E15 (5.6, 7.8): las metas semanales del usuario con el progreso de la semana actual. */
export const GET = conManejoDeErrores(async () => {
  const sesion = await exigirSesion();
  return responderOk(await listarMetasSemanales(sesion.id));
});

/** E15 (RB-16, RB-17): crea una meta de tareas o de tiempo, global o de una categoría. */
export const POST = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  return responderOk(await crearMetaSemanal(sesion.id, await leerCuerpo(peticion, esquemaCrearMetaSemanal)), 201);
});
