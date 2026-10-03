function requiredEnv(...values: Array<string | undefined>): string {
  const value = values.find((entry) => entry?.trim());
  if (!value) {
    throw new Error('Falta configurar la URL o la clave pública del proyecto Supabase.');
  }
  return value;
}

export function getSupabaseConfig() {
  return {
    url: requiredEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL,
      process.env.NEXT_PUBLIC_NOVAASSISTANT_SUPABASE_URL,
    ),
    publishableKey: requiredEnv(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_ANON_KEY,
      process.env.NOVAASSISTANT_SUPABASE_ANON_KEY,
    ),
  };
}
