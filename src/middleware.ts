import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

export async function middleware(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  if (
    ruta === '/prueba-correo' ||
    ruta === '/api/correo/prueba' ||
    ruta === '/recuperar-contrasena' ||
    ruta === '/privacidad' ||
    ruta === '/restablecer-contrasena' ||
    ruta === '/api/auth/recuperar' ||
    ruta === '/api/auth/restablecer' ||
    // E11b: la app instalable es pública (manifiesto, íconos y service worker).
    ruta === '/sw.js' ||
    ruta === '/sw-reglas.js' ||
    ruta === '/manifest.webmanifest' ||
    ruta.startsWith('/icons/') ||
    // E11c: el aviso de cada minuto lo llama Supabase sin sesión; la ruta exige su propio secreto.
    ruta === '/api/nova/recordatorios/tick' ||
    // E21: el cron diario de Vercel, también sin sesión y con su propio secreto.
    ruta === '/api/nova/salud'
  ) {
    return NextResponse.next();
  }

  // E20c-2 (RB-83): la ruta pedida, para que el layout de Nova responda 404 en "Administración" a quien no es
  // administrador antes de empezar a enviar la página (con loading.tsx, un notFound() de la página llega con 200).
  // Se escribe siempre aquí: lo que mande el navegador con ese nombre se reemplaza.
  request.headers.set('x-nova-ruta', ruta);
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

  // E20b (tiempo de carga): la sesión se verifica aquí mismo con la clave pública del proyecto (ES256), sin ir a
  // Supabase Auth en cada pedido; si el token venció, getClaims lo renueva con el de refresco (y pone las cookies).
  const { data: datosSesion } = await supabase.auth.getClaims();
  const claims = datosSesion?.claims;
  const data = { user: claims?.sub ? { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined } : null };

  const esApiNova = ruta === '/api/nova' || ruta.startsWith('/api/nova/');
  const esPaginaNova = ruta === '/nova' || ruta.startsWith('/nova/');
  if (esApiNova || esPaginaNova) {
    // E20c-2: aquí solo se exige la sesión. Si la cuenta entra (activa, pendiente o bloqueada, y con qué nivel) lo
    // decide la tabla `cuentas` en cada pedido, en exigirSesion y en el layout de Nova: el middleware corre en el
    // runtime edge y no consulta la base.
    if (!data.user) {
      if (esApiNova) {
        return NextResponse.json(
          { ok: false, error: { codigo: 'NO_AUTORIZADO', mensaje: 'Debes iniciar sesión.', detalles: null } },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // E11b (RB-63): el service worker guarda la copia sin conexión a nombre de este usuario; si cambia, la borra.
    if (esPaginaNova && data.user) response.headers.set('x-nova-usuario', data.user.id);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
