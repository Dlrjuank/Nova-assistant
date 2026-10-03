import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

    if (error || !data.user) {
      return NextResponse.json(
        { success: false, error: 'Correo o contraseña incorrectos.' },
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

    return NextResponse.json({
      success: true,
      data: { id: profile.id, email: profile.email },
    });
  } catch (error) {
    console.error('No se pudo conectar con Supabase para iniciar sesión.', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo conectar con Supabase. Revisa la configuración del proyecto.' },
      { status: 503 },
    );
  }
}
