import { cache } from 'react';
import { getCurrentUser } from '@/modules/auth/session';
import { tieneAccesoNova } from '@/lib/auth/acceso';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

export interface Sesion {
  id: string; // id de Supabase Auth; identifica al dueño del historial del chat
  email: string;
}

/**
 * Adaptador sobre el login existente (Supabase Auth): devuelve { id, email } o null.
 * Con `cache`, el layout de Nova y la página comparten una sola consulta a Supabase Auth por pedido (antes, cada
 * uno hacía la suya). Fuera de una pantalla del servidor (rutas de la API) `cache` no guarda nada: se consulta igual.
 */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const usuario = await getCurrentUser();
  if (!usuario) return null;
  return { id: usuario.id, email: usuario.email ?? '' };
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
