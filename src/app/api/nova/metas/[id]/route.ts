import { exigirSesion } from '@/lib/auth/sesion';
import { eliminarMetaSemanal } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { esquemaIdMetaSemanal } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** E15: eliminar una meta semanal (la pantalla pide confirmación antes). */
export const DELETE = conManejoDeErrores(async (_peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  return responderOk(await eliminarMetaSemanal(sesion.id, esquemaIdMetaSemanal.parse((await params).id)));
});
