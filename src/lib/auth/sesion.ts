import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { accesoDe } from '@/lib/datos/cuentas';
import { esAdministrador, TEXTO_SIN_PERMISO, type Nivel } from '@/lib/reglas/cuentas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

export interface Sesion {
  id: string; // id de Supabase Auth; identifica al dueño del historial del chat
  email: string;
  /** E20c-3: la sesión se abrió con "Entrar con Google" (`amr` del token): puede poner una contraseña sin la anterior. */
  conGoogle?: boolean;
}

/** Una sesión que entra a Nova, con su nivel (E20c-2, RB-93). */
export interface SesionNova extends Sesion {
  nivel: Nivel;
}

/**
 * Adaptador sobre el login existente (Supabase Auth): devuelve { id, email } o null.
 * Con `cache`, el layout de Nova y la página comparten una sola revisión por pedido.
 * E20b (tiempo de carga): `getClaims` verifica la firma del token con la clave pública del proyecto (ES256, que
 * se guarda unos minutos), sin ir a Supabase Auth; con una clave simétrica, la librería pregunta a Supabase como
 * antes. Un token dura como máximo 1 hora: por eso el estado de la cuenta se revisa en la base en cada pedido
 * (exigirSesion y el layout de Nova), no en el token.
 */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    if (!error || error.status === 401 || error.name === 'AuthSessionMissingError' || error.name === 'AuthInvalidJwtError') return null;
    throw new Error('No se pudo verificar la sesión con Supabase.', { cause: error });
  }
  const amr = (claims as { amr?: Array<{ method?: string }> }).amr;
  const conGoogle = Array.isArray(amr) && amr.some((a) => a?.method === 'oauth');
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '', ...(conGoogle ? { conGoogle } : {}) };
});

/**
 * Primera instrucción de toda ruta /api/nova. Sin sesión → NO_AUTORIZADO (401). E20c-2: decide la fila de
 * `cuentas` (RB-92): pendiente o sin fila → CUENTA_PENDIENTE (403); bloqueada → CUENTA_BLOQUEADA (403).
 */
export async function exigirSesion(): Promise<SesionNova> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new ErrorDeNegocio('NO_AUTORIZADO');
  const acceso = await accesoDe(sesion);
  if (!acceso.permitido) throw new ErrorDeNegocio(acceso.codigo);
  return { ...sesion, nivel: acceso.nivel };
}

/**
 * RB-83: la API de "Administración" es solo de los administradores (y el dueño). Para cualquier otra cuenta,
 * `ACCESO_DENEGADO` con el mensaje de siempre y sin ningún dato.
 */
export async function exigirAdministrador(): Promise<SesionNova> {
  const sesion = await exigirSesion();
  if (!esAdministrador(sesion.nivel)) throw new ErrorDeNegocio('ACCESO_DENEGADO');
  return sesion;
}

/** RB-93: lo que solo hace el dueño (topes, eliminar, niveles, permiso de la clave del proyecto). */
export function exigirDueno(sesion: SesionNova): void {
  if (sesion.nivel !== 'dueno') throw new ErrorDeNegocio('ACCESO_DENEGADO', TEXTO_SIN_PERMISO);
}
