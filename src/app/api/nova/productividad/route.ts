import { exigirSesion } from '@/lib/auth/sesion';
import { calcularProductividad } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaProductividad } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
// Una respuesta de Gemini para la recomendación, con reintentos y modelo de respaldo.
export const maxDuration = 60;

/** CU-05: sin fecha, hoy en Bogotá. */
export const POST = conManejoDeErrores(async (peticion: Request) => {
  await exigirSesion();
  const { fecha } = await leerCuerpo(peticion, esquemaProductividad);
  return responderOk(await calcularProductividad(fecha));
});
