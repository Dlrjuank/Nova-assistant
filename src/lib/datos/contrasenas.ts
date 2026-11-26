import { randomInt } from 'node:crypto';
import { consultar } from '@/lib/db/conexion';
import { generarContrasenaTemporal, revisarTemporal } from '@/lib/reglas/cuentas';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * E20c-3 (RB-91): la contraseña temporal. Nunca se guarda: en `cuentas` solo quedan `debe_cambiar_contrasena`,
 * cuándo vence y cuándo se usó. Sirve para entrar una sola vez y vence a las 24 horas.
 */

interface FilaTemporal {
  debeCambiar: boolean;
  venceEn: string | null;
  usadaEn: string | null;
}

const COLUMNAS = 'debe_cambiar_contrasena AS "debeCambiar", temporal_vence_en AS "venceEn", temporal_usada_en AS "usadaEn"';

/** Al entrar con la contraseña: normal, primera vez con la temporal, ya usada o vencida. */
export async function temporalDe(usuarioId: string): Promise<ReturnType<typeof revisarTemporal>> {
  const [fila] = await consultar<FilaTemporal>(`SELECT ${COLUMNAS} FROM cuentas WHERE usuario_id = $1`, [usuarioId]);
  return fila ? revisarTemporal(fila, new Date()) : 'normal';
}

/**
 * Al fallar la contraseña: si esa cuenta tenía una temporal que venció sin usarse, el inicio de sesión lo dice
 * (el aviso de cada minuto ya la reemplazó por una que nadie conoce).
 */
export async function temporalVencidaDe(correo: string): Promise<boolean> {
  const [fila] = await consultar<{ vencida: boolean }>(
    `SELECT (c.temporal_vence_en IS NOT NULL AND c.temporal_usada_en IS NULL AND c.temporal_vence_en <= now()) AS vencida
     FROM cuentas c JOIN auth.users u ON u.id = c.usuario_id WHERE lower(u.email) = lower($1)`,
    [correo.trim()],
  );
  return fila?.vencida === true;
}

/** La marca de "ya se usó", una sola vez: si otro ingreso la marcó antes, devuelve false. */
export async function usarTemporal(usuarioId: string): Promise<boolean> {
  const filas = await consultar(
    `UPDATE cuentas SET temporal_usada_en = now()
     WHERE usuario_id = $1 AND debe_cambiar_contrasena AND temporal_usada_en IS NULL AND temporal_vence_en > now()
     RETURNING 1`,
    [usuarioId],
  );
  return filas.length === 1;
}

/** Ya puso una contraseña propia: la cuenta vuelve a la normalidad. */
export async function terminarCambioContrasena(usuarioId: string): Promise<void> {
  await consultar(
    'UPDATE cuentas SET debe_cambiar_contrasena = false, temporal_vence_en = NULL, temporal_usada_en = NULL WHERE usuario_id = $1',
    [usuarioId],
  );
}

/** Una contraseña al azar de 16 caracteres (también la que nadie conoce, al vencer). */
export const contrasenaAlAzar = () => generarContrasenaTemporal((n) => randomInt(n));

/**
 * El aviso de cada minuto: una temporal que venció sin usarse se reemplaza por una al azar que nadie conoce. La
 * cuenta deja de estar obligada a cambiarla (ya no hay con qué entrar); `temporal_vence_en` queda para el mensaje.
 */
export async function vencerContrasenasTemporales(): Promise<number> {
  const vencidas = await consultar<{ usuario_id: string }>(
    `SELECT usuario_id FROM cuentas
     WHERE debe_cambiar_contrasena AND temporal_usada_en IS NULL AND temporal_vence_en <= now()`,
  );
  let n = 0;
  for (const { usuario_id: id } of vencidas) {
    const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(id, { password: contrasenaAlAzar() });
    if (error) {
      console.error('No se pudo reemplazar una contraseña temporal vencida:', error.message);
      continue;
    }
    await consultar('UPDATE cuentas SET debe_cambiar_contrasena = false WHERE usuario_id = $1 AND temporal_usada_en IS NULL', [id]);
    n++;
  }
  return n;
}
