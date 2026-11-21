import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { tieneAccesoNova } from '@/lib/auth/acceso';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

export interface Sesion {
  id: string; // id de Supabase Auth; identifica al dueño del historial del chat
  email: string;
}

/**
 * Adaptador sobre el login existente (Supabase Auth): devuelve { id, email } o null.
 * Con `cache`, el layout de Nova y la página comparten una sola revisión por pedido.
 * E20b (tiempo de carga): `getClaims` verifica la firma del token con la clave pública del proyecto (ES256, que
 * se guarda unos minutos), sin ir a Supabase Auth; con una clave simétrica, la librería pregunta a Supabase como
 * antes. Un token dura como máximo 1 hora: una sesión cerrada en otro dispositivo vale hasta que venza.
 */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    if (!error || error.status === 401 || error.name === 'AuthSessionMissingError' || error.name === 'AuthInvalidJwtError') return null;
    throw new Error('No se pudo verificar la sesión con Supabase.', { cause: error });
  }
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' };
});

/**
 * Primera instrucción de toda ruta /api/nova. Sin sesión → NO_AUTORIZADO (401);
 * con sesión pero fuera de la lista → ACCESO_DENEGADO (403).
 */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new ErrorDeNegocio('NO_AUTORIZADO');
  if (!tieneAccesoNova(sesion.email)) throw new ErrorDeNegocio('ACCESO_DENEGADO');
  return sesion;
}
