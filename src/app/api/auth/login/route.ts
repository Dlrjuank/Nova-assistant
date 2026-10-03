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

    return NextResponse.json({
      success: true,
      data: { id: data.user.id, email: data.user.email },
    });
  } catch (error) {
    console.error('No se pudo conectar con Supabase para iniciar sesión.', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo conectar con Supabase. Revisa la configuración del proyecto.' },
      { status: 503 },
    );
  }
}
