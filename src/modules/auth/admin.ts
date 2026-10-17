const builtInAdminEmails = ['juandelarosa1617@gmail.com'];

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
