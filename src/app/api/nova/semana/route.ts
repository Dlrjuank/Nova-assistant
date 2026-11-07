import { exigirSesion } from '@/lib/auth/sesion';
import { semanaDeTareas } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { esFechaISOValida } from '@/lib/reglas/fechas';

export const dynamic = 'force-dynamic';

/** E06: tareas y progreso de la semana de `inicio` (cualquier día de esa semana; sin él, la actual). */
export const GET = conManejoDeErrores(async (peticion: Request) => {
  const { id } = await exigirSesion();
  const inicio = new URL(peticion.url).searchParams.get('inicio') ?? undefined;
  if (inicio !== undefined && !esFechaISOValida(inicio)) throw new ErrorDeNegocio('FECHA_INVALIDA');
  return responderOk(await semanaDeTareas(id, inicio));
});
