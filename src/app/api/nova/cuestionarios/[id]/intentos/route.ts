import { exigirSesion } from '@/lib/auth/sesion';
import { empezarIntento } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaEmpezarIntento, esquemaIdCuestionario } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E10e: "Hacer de nuevo", o con `repasoDe` "Repetir solo las que fallé". No llama a Gemini. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await exigirSesion();
  const id = esquemaIdCuestionario.parse((await params).id);
  const { repasoDe } = await leerCuerpo(peticion, esquemaEmpezarIntento);
  return responderOk(await empezarIntento(sesion.id, id, repasoDe), 201);
});
