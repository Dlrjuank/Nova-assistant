import { isAdminEmail } from '@/modules/auth/admin';

/**
 * Nova es de una sola persona y /register está abierto, así que solo entran los correos de la lista de
 * administradores (SUPABASE_ADMIN_EMAILS más el correo incorporado en modules/auth/admin.ts).
 * Vive aparte de sesion.ts porque el middleware (runtime edge) no puede importar next/headers.
 */
export function tieneAccesoNova(email: string | undefined): boolean {
  return isAdminEmail(email);
}
