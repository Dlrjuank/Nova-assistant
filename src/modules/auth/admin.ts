export function isAdminEmail(email: string | undefined): boolean {
  if (!email) {
    return false;
  }

  const adminEmails = (process.env.SUPABASE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.trim().toLowerCase());
}
