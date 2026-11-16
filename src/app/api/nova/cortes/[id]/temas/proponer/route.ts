import { exigirSesion } from '@/lib/auth/sesion';
import { proponerTemas } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaIdSemestre, esquemaProponerTemas } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // llama a Gemini (plan, sección 10)

type Contexto = { params: Promise<{ id: string }> };

/** E17 (9.1; RB-19, RB-21): temas propuestos desde un PDF de la materia; se guardan como propuestos. */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  const { documentoId } = await leerCuerpo(peticion, esquemaProponerTemas);
  return responderOk(await proponerTemas(sesion.id, id, documentoId), 201);
});
