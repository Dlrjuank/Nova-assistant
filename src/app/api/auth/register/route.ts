import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const registrationSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'El cuerpo de la solicitud no es válido.' }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Ingresa un correo válido y una contraseña de 8 a 128 caracteres.' },
      { status: 400 },
    );
  }

  try {
    const adminSupabase = createSupabaseAdminClient();
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: parsed.data.email.trim(),
      password: parsed.data.password,
      email_confirm: true,
    });

    if (error) {
      console.error('Supabase rechazó el registro.', error.message);
      return NextResponse.json(
        { success: false, error: 'Supabase no pudo crear la cuenta. Comprueba si el correo ya está registrado y revisa la configuración del servidor.' },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email.trim(),
      password: parsed.data.password,
    });

    if (signInError || !sessionData.user) {
      console.error('La cuenta se creó, pero no se pudo iniciar sesión automáticamente.', signInError?.message);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: data.user?.id ?? null,
          email: data.user?.email ?? parsed.data.email.trim(),
          requiresEmailConfirmation: false,
          requiresLogin: Boolean(signInError || !sessionData.user),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('No se pudo conectar con Supabase para registrar la cuenta.', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo conectar con Supabase. Revisa la configuración del proyecto.' },
      { status: 503 },
    );
  }
}
