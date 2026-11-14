import { exigirSesion } from '@/lib/auth/sesion';
import { crearComponente } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaComponente, esquemaIdSemestre } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** RB-08, RB-10: un componente de evaluación del corte (en una materia sin cortes, de su corte único). */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  return responderOk(await crearComponente(sesion.id, id, await leerCuerpo(peticion, esquemaComponente)), 201);
});
