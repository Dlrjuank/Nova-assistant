import { getCurrentUser } from '@/modules/auth/session';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

/** Adaptador sobre el login existente (Supabase Auth): devuelve { email } o null. */
export async function obtenerSesion(): Promise<{ email: string } | null> {
  const usuario = await getCurrentUser();
  if (!usuario) return null;
  return { email: usuario.email ?? '' };
}

/** Lanza NO_AUTORIZADO si no hay sesión. Primera instrucción de toda ruta /api/nova. */
export async function exigirSesion(): Promise<{ email: string }> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new ErrorDeNegocio('NO_AUTORIZADO');
  return sesion;
}
