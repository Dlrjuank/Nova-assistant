import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/modules/auth/admin';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('No se pudo confirmar la sesión de Supabase.', error.message);
      return NextResponse.redirect(new URL('/login?error=auth-confirmation', url.origin));
    }
    const { data: userData } = await supabase.auth.getUser();
    return NextResponse.redirect(
      new URL(isAdminEmail(userData.user?.email) ? '/dashboard' : '/home', url.origin),
    );
  }

  return NextResponse.redirect(new URL('/login?error=auth-confirmation', url.origin));
}
