/** E20c (cambios del 2026-11-25): el dueño de Nova es solo el correo incorporado (nunca SUPABASE_ADMIN_EMAILS). */
export const CORREO_DUENO = 'juandelarosa1617@gmail.com';
const builtInAdminEmails = [CORREO_DUENO];

export function esCorreoDueno(email: string | null | undefined): boolean {
  return Boolean(email) && email!.trim().toLowerCase() === CORREO_DUENO;
}

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) {
    return false;
  }

  const adminEmails = [
    process.env.SUPABASE_ADMIN_EMAILS ?? '',
    ...builtInAdminEmails,
  ]
    .flatMap((configuredEmails) => configuredEmails.split(','))
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.trim().toLowerCase());
}
