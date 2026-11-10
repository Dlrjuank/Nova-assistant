import { exigirSesion } from '@/lib/auth/sesion';
import { buscarEnWikipedia } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaWeb } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
// Una búsqueda en Wikipedia (máximo 10 s) y una respuesta de Gemini con reintentos y modelo de respaldo.
export const maxDuration = 60;

/** CU-06: desde E10c2 solo busca; guardar es POST /api/nova/web/fuentes (RB-55). */
export const POST = conManejoDeErrores(async (peticion: Request) => {
  await exigirSesion();
  const { consulta } = await leerCuerpo(peticion, esquemaWeb);
  return responderOk(await buscarEnWikipedia(consulta));
});
