import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
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

  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'La contraseña actual es obligatoria y la nueva debe tener entre 8 y 128 caracteres.' },
      { status: 400 },
    );
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json(
      { success: false, error: 'La nueva contraseña debe ser diferente de la actual.' },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !sessionData.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Inicia sesión para cambiar tu contraseña.' },
        { status: 401 },
      );
    }

    const { data: verifiedData, error: verificationError } = await supabase.auth.signInWithPassword({
      email: sessionData.user.email,
      password: parsed.data.currentPassword,
    });

    if (verificationError || verifiedData.user?.id !== sessionData.user.id) {
      return NextResponse.json(
        { success: false, error: 'La contraseña actual es incorrecta.' },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });

    if (updateError) {
      console.error('Supabase rechazó el cambio de contraseña.', updateError.message);
      return NextResponse.json(
        { success: false, error: 'No se pudo actualizar la contraseña en Supabase.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('No se pudo cambiar la contraseña del usuario.', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo conectar con Supabase para cambiar la contraseña.' },
      { status: 503 },
    );
  }
}
