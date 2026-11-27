import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

/**
 * Solo corre en las páginas que leen la sesión (ver `config.matcher`): un componente de servidor no puede guardar las
 * cookies de una sesión renovada, así que se renueva aquí. Lo demás no lo necesita (E21, ahorro de CPU): las rutas
 * /api revisan la sesión y guardan sus cookies ellas mismas (o exigen su propio secreto), y los archivos públicos y
 * las pantallas sin sesión no la leen. Una página nueva que lea la sesión va en el matcher (lo vigila
 * tests/reglas/middleware.test.ts).
 */
export async function middleware(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
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
  const usuario = datosSesion?.claims?.sub;

  if (ruta === '/nova' || ruta.startsWith('/nova/')) {
    // E20c-2: aquí solo se exige la sesión. Si la cuenta entra (activa, pendiente o bloqueada, y con qué nivel) lo
    // decide la tabla `cuentas` en cada pedido, en el layout y las páginas de Nova: el middleware corre en el
    // runtime edge y no consulta la base.
    if (!usuario) return NextResponse.redirect(new URL('/login', request.url));
    // E11b (RB-63): el service worker guarda la copia sin conexión a nombre de este usuario; si cambia, la borra.
    response.headers.set('x-nova-usuario', usuario);
  }

  return response;
}

export const config = {
  // `/nova/:path*` incluye `/nova`.
  matcher: ['/', '/cuenta', '/cambiar-contrasena', '/nova/:path*'],
};
