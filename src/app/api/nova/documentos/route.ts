import { exigirSesion } from '@/lib/auth/sesion';
import { indexarDocumento, listarDocumentos } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaIndexar } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
// Genera embeddings de todos los fragmentos. Con el límite de Gemini de 30.000 tokens por minuto,
// un documento largo necesita varios minutos (ver ESPERA_MAXIMA_INDEXAR_MS en lib/llm/gemini.ts).
export const maxDuration = 300;

export const GET = conManejoDeErrores(async () => {
  const { id } = await exigirSesion();
  return responderOk(await listarDocumentos(id));
});

export const POST = conManejoDeErrores(async (peticion: Request) => {
  const { id } = await exigirSesion();
  const datos = await leerCuerpo(peticion, esquemaIndexar);
  return responderOk(await indexarDocumento(id, datos), 201);
});
