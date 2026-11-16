import { exigirSesion } from '@/lib/auth/sesion';
import { guardarMetaNota, quitarMetaNota } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaGuardarMetaNota, esquemaQuitarMetaNota } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E16 (6.7, RB-18): crea o cambia la meta de nota de una materia (corteId null) o de uno de sus cortes. */
export const PUT = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  return responderOk(await guardarMetaNota(sesion.id, await leerCuerpo(peticion, esquemaGuardarMetaNota)));
});

/** E16: quita la meta; `?materia=` y `?corte=` (sin corte = la de la materia). */
export const DELETE = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  const url = new URL(peticion.url);
  const datos = esquemaQuitarMetaNota.parse({ materiaId: url.searchParams.get('materia'), corteId: url.searchParams.get('corte') || null });
  return responderOk(await quitarMetaNota(sesion.id, datos));
});
