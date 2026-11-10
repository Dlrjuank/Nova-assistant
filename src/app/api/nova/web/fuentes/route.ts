import { exigirSesion } from '@/lib/auth/sesion';
import { guardarFuenteWeb, listarFuentesWeb } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaGuardarFuente } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
// Un embedding de Gemini, con su espera por la cuota.
export const maxDuration = 60;

/** E10b2 (RB-54): las fuentes web guardadas del usuario. */
export const GET = conManejoDeErrores(async () => {
  const { id } = await exigirSesion();
  return responderOk(await listarFuentesWeb(id));
});

/** E10c2 (RB-55): "Guardar fuente". */
export const POST = conManejoDeErrores(async (peticion: Request) => {
  const { id } = await exigirSesion();
  return responderOk(await guardarFuenteWeb(id, await leerCuerpo(peticion, esquemaGuardarFuente)), 201);
});
