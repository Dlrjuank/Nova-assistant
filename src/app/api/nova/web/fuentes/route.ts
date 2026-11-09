import { exigirSesion } from '@/lib/auth/sesion';
import { listarFuentesWeb } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';

export const dynamic = 'force-dynamic';

/** E10b2 (RB-54): las fuentes web guardadas del usuario. */
export const GET = conManejoDeErrores(async () => {
  const { id } = await exigirSesion();
  return responderOk(await listarFuentesWeb(id));
});
