import { exigirSesion } from '@/lib/auth/sesion';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';

export const dynamic = 'force-dynamic';

export const GET = conManejoDeErrores(async () => {
  const sesion = await exigirSesion();
  return responderOk({ email: sesion.email });
});
