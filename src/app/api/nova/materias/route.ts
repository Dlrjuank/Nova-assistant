import { exigirSesion } from '@/lib/auth/sesion';
import { crearMateria, listarMaterias } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaCrearMateria } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E12 (5.7): las materias del usuario con sus cortes, componentes y notas. */
export const GET = conManejoDeErrores(async () => {
  const sesion = await exigirSesion();
  return responderOk(await listarMaterias(sesion.id));
});

/** E12 (6.4, RB-05, RB-06): crea la materia sin cortes y su categoría de tareas. */
export const POST = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  const datos = await leerCuerpo(peticion, esquemaCrearMateria);
  return responderOk(await crearMateria(sesion.id, datos), 201);
});
