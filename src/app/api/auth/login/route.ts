import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { accesoDe } from '@/lib/datos/cuentas';
import { temporalDe, temporalVencidaDe, usarTemporal } from '@/lib/datos/contrasenas';
import { TEXTO_TEMPORAL_USADA, TEXTO_TEMPORAL_VENCIDA } from '@/lib/reglas/cuentas';
import { MENSAJES } from '@/lib/reglas/errores';
import { isAdminEmail } from '@/modules/auth/admin';

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'El cuerpo de la solicitud no es válido.' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Ingresa un correo y una contraseña válidos.' }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email.trim(),
      password: parsed.data.password,
    });

    // E20c-2 (RB-82): Supabase rechaza a una cuenta bloqueada (ban) aunque la contraseña sea la correcta.
    if (error?.code === 'user_banned') {
      return NextResponse.json({ success: false, error: MENSAJES.CUENTA_BLOQUEADA }, { status: 403 });
    }

    if (error || !data.user) {
      // E20c-3 (RB-91): si esa cuenta tenía una contraseña temporal que venció sin usarse, se dice.
      const vencida = await temporalVencidaDe(parsed.data.email).catch(() => false);
      return NextResponse.json(
        { success: false, error: vencida ? TEXTO_TEMPORAL_VENCIDA : 'Correo o contraseña incorrectos.' },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('No se pudo verificar la cuenta en public.users.', profileError.message);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('No se pudo limpiar la sesión tras el error de public.users.', signOutError.message);
      }
      return NextResponse.json(
        {
          success: false,
          error: 'No se pudo consultar public.users. Verifica que la migración de Supabase esté aplicada.',
        },
        { status: 503 },
      );
    }

    if (!profile) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('No se pudo limpiar la sesión de una cuenta ausente en public.users.', signOutError.message);
      }
      return NextResponse.json(
        {
          success: false,
          error: 'La cuenta no existe en public.users. Regístrala de nuevo o sincroniza la tabla de usuarios.',
        },
        { status: 403 },
      );
    }

    // E20c-2 (RB-82, RB-92): una cuenta pendiente o bloqueada no entra; se cierra la sesión que se acaba de abrir.
    const acceso = await accesoDe({ id: data.user.id, email: data.user.email ?? '' });
    // E20c-3 (RB-91): con la contraseña temporal se entra una sola vez, antes de que venza; después solo queda la
    // pantalla para poner una propia (el layout de Nova lleva a /cambiar-contrasena).
    if (!acceso.permitido && acceso.codigo === 'DEBE_CAMBIAR_CONTRASENA') {
      const temporal = await temporalDe(data.user.id);
      const usada = temporal === 'primera' ? !(await usarTemporal(data.user.id)) : temporal === 'usada';
      if (usada || temporal === 'vencida') {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        return NextResponse.json({ success: false, error: usada ? TEXTO_TEMPORAL_USADA : TEXTO_TEMPORAL_VENCIDA }, { status: 403 });
      }
      return NextResponse.json({ success: true, data: { id: data.user.id, email: data.user.email, isAdmin: false, debeCambiar: true } });
    }
    if (!acceso.permitido) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      return NextResponse.json({ success: false, error: MENSAJES[acceso.codigo] }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: profile.id,
        email: profile.email,
        isAdmin: isAdminEmail(profile.email ?? data.user.email),
      },
    });
  } catch (error) {
    console.error('No se pudo conectar con Supabase para iniciar sesión.', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo conectar con Supabase. Revisa la configuración del proyecto.' },
      { status: 503 },
    );
  }
}
