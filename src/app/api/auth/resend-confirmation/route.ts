import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const resendSchema = z.object({
  email: z.string().trim().pipe(z.email().max(254)),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'El cuerpo de la solicitud no es válido.' },
      { status: 400 },
    );
  }

  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Ingresa un correo electrónico válido.' },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: parsed.data.email,
      options: {
        emailRedirectTo: new URL('/auth/callback', request.url).toString(),
      },
    });

    if (error) {
      console.error('Supabase rechazó el reenvío de la confirmación.', error.message);
      return NextResponse.json(
        { success: false, error: 'No se pudo reenviar el correo de confirmación. Verifica la cuenta y la configuración de Supabase.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('No se pudo reenviar el correo de confirmación.', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo conectar con Supabase para reenviar la confirmación.' },
      { status: 503 },
    );
  }
}
