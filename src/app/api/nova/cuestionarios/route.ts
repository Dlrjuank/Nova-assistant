import { exigirSesion } from '@/lib/auth/sesion';
import { crearCuestionario, listarCuestionarios } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaCrearCuestionario, esquemaHistorialCuestionarios } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
// Hasta 2 llamadas a Gemini con hasta 60 fragmentos (9.6.7). El plan Hobby con Fluid Compute admite 300 s.
export const maxDuration = 120;

/** E10e (9.6): genera un cuestionario de un documento del usuario. */
export const POST = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  const datos = await leerCuerpo(peticion, esquemaCrearCuestionario);
  return responderOk(await crearCuestionario(sesion.id, datos), 201);
});

/** E10f (5.11): el historial del usuario, por documento y capítulo; `?documentoId=` para uno solo. */
export const GET = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  const documentoId = new URL(peticion.url).searchParams.get('documentoId') ?? undefined;
  const filtro = esquemaHistorialCuestionarios.parse({ documentoId });
  return responderOk(await listarCuestionarios(sesion.id, filtro.documentoId));
});
