import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

function getServiceRoleKey(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY;

  if (!key?.trim()) {
    throw new Error('Falta configurar la clave de servicio de Supabase en el servidor.');
  }

  return key;
}

export function createSupabaseAdminClient() {
  const { url } = getSupabaseConfig();
  return createClient(url, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
