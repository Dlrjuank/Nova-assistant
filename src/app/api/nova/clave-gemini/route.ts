import { desvincularClaveGemini, exigirSesion, guardarClaveGemini, infoClaveGemini } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaClaveGemini } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E20c-1 (5.14): solo `{ vinculada, ultimos4, estado, verificadaEn }`; nunca la clave. */
export const GET = conManejoDeErrores(async () => {
  const sesion = await exigirSesion();
  return responderOk(await infoClaveGemini(sesion.id));
});

/** RB-77: verificar con Google y guardar (o cambiar). Si Google no la acepta, no se guarda nada. */
export const PUT = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  const { clave } = await leerCuerpo(peticion, esquemaClaveGemini);
  return responderOk(await guardarClaveGemini(sesion.id, clave));
});

/** RB-80: desvincular (la pantalla pide la confirmación antes). */
export const DELETE = conManejoDeErrores(async () => {
  const sesion = await exigirSesion();
  await desvincularClaveGemini(sesion.id);
  return responderOk({ vinculada: false });
});
