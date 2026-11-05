import { getCurrentUser } from '@/modules/auth/session';
import { tieneAccesoNova } from '@/lib/auth/acceso';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

/** Adaptador sobre el login existente (Supabase Auth): devuelve { email } o null. */
export async function obtenerSesion(): Promise<{ email: string } | null> {
  const usuario = await getCurrentUser();
  if (!usuario) return null;
  return { email: usuario.email ?? '' };
}

/**
 * Primera instrucción de toda ruta /api/nova. Sin sesión → NO_AUTORIZADO (401);
 * con sesión pero fuera de la lista → ACCESO_DENEGADO (403).
 */
export async function exigirSesion(): Promise<{ email: string }> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new ErrorDeNegocio('NO_AUTORIZADO');
  if (!tieneAccesoNova(sesion.email)) throw new ErrorDeNegocio('ACCESO_DENEGADO');
  return sesion;
}
