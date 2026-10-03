import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Supabase rechazó el cierre de sesión.', error.message);
      return NextResponse.json(
        { success: false, error: 'No se pudo cerrar la sesión de Supabase.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('No se pudo conectar con Supabase para cerrar sesión.', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo conectar con Supabase.' },
      { status: 503 },
    );
  }
}
