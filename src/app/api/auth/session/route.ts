import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (
      error &&
      error.status !== 401 &&
      error.name !== 'AuthSessionMissingError'
    ) {
      console.error('No se pudo verificar la sesión de Supabase.', error.message);
      return NextResponse.json(
        { success: false, error: 'No se pudo verificar la sesión con Supabase.' },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      data: data.user ? { id: data.user.id, email: data.user.email } : null,
    });
  } catch (error) {
    console.error('No se pudo consultar la sesión de Supabase.', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo conectar con Supabase.' },
      { status: 503 },
    );
  }
}
