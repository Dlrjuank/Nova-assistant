import { exigirSesion } from '@/lib/auth/sesion';
import { responderOcr } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaIdDocumento, esquemaRespuestaOcr } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E20d-3: "Leerlas" o "Ahora no" para las páginas escaneadas o las fotos de un documento propio (RB-01). */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: usuarioId } = await exigirSesion();
  const id = esquemaIdDocumento.parse((await params).id);
  const { leer } = await leerCuerpo(peticion, esquemaRespuestaOcr);
  return responderOk(await responderOcr(usuarioId, id, leer));
});
