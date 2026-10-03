import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (error.status === 401 || error.name === 'AuthSessionMissingError') {
      return null;
    }
    throw new Error('No se pudo verificar la sesión con Supabase.', { cause: error });
  }

  return data.user;
}
