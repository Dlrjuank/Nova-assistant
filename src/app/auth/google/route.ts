import { NextResponse } from 'next/server';
import { origenPublico } from '@/lib/http/origen';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * E20c-3 (RB-81): pide a Supabase la dirección de Google y lleva allí. Supabase guarda en una cookie el verificador
 * (PKCE) que /auth/callback usa al volver. `select_account`: Google deja elegir la cuenta aunque haya una abierta.
 */
export async function GET(peticion: Request) {
  const origen = origenPublico(peticion);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origen}/auth/callback?next=/nova`, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error || !data.url) {
      console.error('Supabase no dio la dirección de Google:', error?.message);
      return NextResponse.redirect(new URL('/login?error=google', origen));
    }
    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error('No se pudo empezar la entrada con Google:', error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL('/login?error=google', origen));
  }
}
