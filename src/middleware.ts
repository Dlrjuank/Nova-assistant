import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { tieneAccesoNova } from '@/lib/auth/acceso';
import { getSupabaseConfig } from '@/lib/supabase/config';

export async function middleware(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  if (
    ruta === '/prueba-correo' ||
    ruta === '/api/correo/prueba' ||
    ruta === '/recuperar-contrasena' ||
    ruta === '/restablecer-contrasena' ||
    ruta === '/api/auth/recuperar' ||
    ruta === '/api/auth/restablecer'
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  const esApiNova = ruta === '/api/nova' || ruta.startsWith('/api/nova/');
  const esPaginaNova = ruta === '/nova' || ruta.startsWith('/nova/');
  if (esApiNova || esPaginaNova) {
    const sinSesion = !data.user;
    if (sinSesion || !tieneAccesoNova(data.user?.email)) {
      if (esApiNova) {
        const [estado, codigo, mensaje] = sinSesion
          ? [401, 'NO_AUTORIZADO', 'Debe iniciar sesión.']
          : [403, 'ACCESO_DENEGADO', 'Su cuenta no tiene acceso a Nova Assistant.'];
        return NextResponse.json(
          { ok: false, error: { codigo, mensaje, detalles: null } },
          { status: estado, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.redirect(new URL(sinSesion ? '/login' : '/home', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
