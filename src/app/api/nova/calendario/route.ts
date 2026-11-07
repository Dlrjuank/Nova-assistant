import { exigirSesion } from '@/lib/auth/sesion';
import { mesDeTareas } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esMesValido } from '@/lib/reglas/calendario';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

export const dynamic = 'force-dynamic';

/** E07: tareas del mes por día (`?mes=YYYY-MM`; sin él, el mes actual). Un mes inválido es 400. */
export const GET = conManejoDeErrores(async (peticion: Request) => {
  const { id } = await exigirSesion();
  const mes = new URL(peticion.url).searchParams.get('mes') ?? undefined;
  if (mes !== undefined && !esMesValido(mes)) throw new ErrorDeNegocio('DATOS_INVALIDOS');
  return responderOk(await mesDeTareas(id, mes));
});
