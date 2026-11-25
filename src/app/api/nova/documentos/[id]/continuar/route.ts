import { exigirSesion } from '@/lib/auth/sesion';
import { continuarIndexacion, exigirEspacio } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdDocumento } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
// E10b (RB-38): cada llamada indexa una parte; puede esperar la cuota por minuto de Gemini.
export const maxDuration = 300;

export const POST = conManejoDeErrores(async (_peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdDocumento.parse((await params).id);
  // E20c-2 (RB-85): pasado el tope de espacio, el libro queda en pausa (no se borra nada).
  await exigirEspacio(sesion.id, sesion.nivel);
  return responderOk(await continuarIndexacion(sesion.id, id));
});
