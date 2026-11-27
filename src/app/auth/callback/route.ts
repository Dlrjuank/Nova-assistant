import { NextResponse } from 'next/server';
import { consultar } from '@/lib/db/conexion';
import { origenPublico } from '@/lib/http/origen';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Solo destinos dentro de Nova; cualquier otra cosa va a /nova. */
function destinoSeguro(next: string | null): string {
  return next && /^\/nova(?:[/?#]|$)/.test(next) ? next : '/nova';
}

/**
 * Vuelta de Supabase (Google, E20c-3, y los enlaces de confirmación de correo). Con la sesión abierta va a Nova, y
 * el layout decide si la cuenta entra (pendiente o bloqueada van a /cuenta).
 * RB-81, "por si acaso": el gancho "Before User Created" ya frena las cuentas nuevas con el tope alcanzado; si una
 * cuenta nueva de Google igual pasó el tope, se borra y se avisa en /login.
 */
export async function GET(peticion: Request) {
  const url = new URL(peticion.url);
  const origen = origenPublico(peticion);
  const code = url.searchParams.get('code');
  const aLogin = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, origen));

  if (!code) {
    // Sin código: Google o el gancho rechazaron la entrada (el gancho del tope dice "máximo de cuentas").
    const descripcion = `${url.searchParams.get('error_description') ?? ''} ${url.searchParams.get('error') ?? ''}`;
    return aLogin(/m[aá]ximo de cuentas/i.test(descripcion) ? 'tope' : 'google');
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error('No se pudo confirmar la sesión de Supabase.', error?.message);
    return aLogin('google');
  }

  const usuario = data.user;
  const nueva = Date.now() - new Date(usuario.created_at).getTime() < 10 * 60 * 1000;
  if (nueva && usuario.app_metadata?.provider === 'google') {
    const [fila] = await consultar<{ pasa: boolean; nivel: string | null }>(
      `SELECT (SELECT count(*) FROM cuentas WHERE nivel = 'usuario') > (SELECT tope_cuentas FROM administracion WHERE id = 1) AS pasa,
              (SELECT nivel FROM cuentas WHERE usuario_id = $1) AS nivel`,
      [usuario.id],
    );
    if (fila?.pasa && fila.nivel === 'usuario') {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      const { error: borrar } = await createSupabaseAdminClient().auth.admin.deleteUser(usuario.id);
      if (borrar) console.error('No se pudo borrar la cuenta que pasó el tope:', borrar.message);
      return aLogin('tope');
    }
  }

  return NextResponse.redirect(new URL(destinoSeguro(url.searchParams.get('next')), origen));
}
