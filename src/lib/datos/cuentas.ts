import { cache } from 'react';
import { consultar } from '@/lib/db/conexion';
import { correosDeEmergencia, esAdministrador, resolverAcceso, textoEspacioAgotado, type Acceso, type FilaCuenta, type Nivel } from '@/lib/reglas/cuentas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { CORREO_DUENO } from '@/modules/auth/admin';

/**
 * E20c-2 (M25, RB-92, RB-93): la fila de `cuentas` de esa persona, revisada en cada pedido (también con una sesión ya
 * abierta: bloquear corta el acceso en el siguiente pedido). De paso anota el último acceso, como mucho una vez por
 * hora, para no escribir en cada pedido. Con `cache`, el layout y la página comparten una sola consulta por pedido.
 */
export const leerCuenta = cache(async (usuarioId: string): Promise<FilaCuenta | null> => {
  const [fila] = await consultar<FilaCuenta>(
    `WITH toque AS (
       UPDATE cuentas SET ultimo_acceso = now()
       WHERE usuario_id = $1 AND estado = 'activa' AND (ultimo_acceso IS NULL OR ultimo_acceso < now() - interval '1 hour')
       RETURNING 1
     )
     SELECT estado, nivel, debe_cambiar_contrasena AS "debeCambiar" FROM cuentas WHERE usuario_id = $1 AND (SELECT count(*) FROM toque) >= 0`,
    [usuarioId],
  );
  return fila ?? null;
});

/** Si esa sesión entra a Nova y con qué nivel. */
export async function accesoDe(sesion: { id: string; email: string }): Promise<Acceso> {
  return resolverAcceso(sesion.email, await leerCuenta(sesion.id), CORREO_DUENO, correosDeEmergencia(process.env.SUPABASE_ADMIN_EMAILS));
}

/** 7.16: el espacio estimado de una cuenta, en bytes (M25, `nova_espacio`). */
export async function espacioDe(usuarioId: string): Promise<number> {
  const [fila] = await consultar<{ bytes: string }>('SELECT bytes FROM nova_espacio($1)', [usuarioId]);
  return fila ? Number(fila.bytes) : 0;
}

/**
 * RB-85: al subir un PDF y antes de cada parte de la indexación. Pasado el tope no se sube ni se indexa más, y no se
 * borra nada. Los administradores (y el dueño) no tienen tope.
 */
export async function exigirEspacio(usuarioId: string, nivel: Nivel): Promise<void> {
  if (esAdministrador(nivel)) return;
  const [fila] = await consultar<{ tope: number; bytes: string | null }>(
    'SELECT a.tope_espacio_mb AS tope, (SELECT e.bytes FROM nova_espacio($1) e) AS bytes FROM administracion a WHERE a.id = 1',
    [usuarioId],
  );
  if (!fila) return;
  if (Number(fila.bytes ?? 0) >= fila.tope * 1024 * 1024) throw new ErrorDeNegocio('ESPACIO_AGOTADO', textoEspacioAgotado(fila.tope));
}
