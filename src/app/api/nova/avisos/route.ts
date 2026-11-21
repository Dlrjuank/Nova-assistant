import { exigirSesion } from '@/lib/auth/sesion';
import { avisosNavegacion } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';

export const dynamic = 'force-dynamic';

/** E20b (commit 1): el nombre del perfil, las tareas vencidas y el próximo corte, para la navegación. */
export const GET = conManejoDeErrores(async () => {
  const sesion = await exigirSesion();
  return responderOk(await avisosNavegacion(sesion.id));
});
