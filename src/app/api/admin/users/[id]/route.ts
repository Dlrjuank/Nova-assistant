import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/modules/auth/admin';

const userUpdateSchema = z.object({
  email: z.email().max(254),
  full_name: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  password: z.string().min(8).max(128).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const { data, error: authError } = await supabase.auth.getUser();

  if (authError || !data.user) {
    return NextResponse.json({ success: false, error: 'Inicia sesión para continuar.' }, { status: 401 });
  }
  if (!isAdminEmail(data.user.email)) {
    return NextResponse.json({ success: false, error: 'Se requiere acceso de administrador.' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ success: false, error: 'El ID de usuario no es válido.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'El cuerpo de la solicitud no es válido.' }, { status: 400 });
  }

  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Revisa el correo, el nombre, el teléfono y la longitud de la nueva contraseña (8 a 128 caracteres).' },
      { status: 400 },
    );
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { data: existingUser, error: lookupError } = await adminClient
      .from('users')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      console.error('No se pudo consultar el usuario antes de actualizarlo.', lookupError.message);
      return NextResponse.json(
        { success: false, error: 'No se pudo consultar el usuario en Supabase.' },
        { status: 503 },
      );
    }
    if (!existingUser) {
      return NextResponse.json({ success: false, error: 'No se encontró el usuario.' }, { status: 404 });
    }

    const normalizedEmail = parsed.data.email.trim();
    const emailChanged = normalizedEmail.toLowerCase() !== existingUser.email?.trim().toLowerCase();
    if (id === data.user.id && emailChanged && !isAdminEmail(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Para conservar el acceso de administrador, agrega el nuevo correo a SUPABASE_ADMIN_EMAILS antes de cambiarlo.',
        },
        { status: 400 },
      );
    }

    if (emailChanged || parsed.data.password) {
      const authAttributes: { email?: string; password?: string } = {};
      if (emailChanged) {
        authAttributes.email = normalizedEmail;
      }
      if (parsed.data.password) {
        authAttributes.password = parsed.data.password;
      }

      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(id, authAttributes);
      if (authUpdateError) {
        console.error('No se pudieron actualizar las credenciales del usuario.', authUpdateError.message);
        return NextResponse.json(
          { success: false, error: 'Supabase no pudo actualizar las credenciales del usuario.' },
          { status: 400 },
        );
      }
    }

    const { data: user, error: updateError } = await adminClient
      .from('users')
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, email, full_name, phone, created_at')
      .maybeSingle();

    if (updateError) {
      console.error('No se pudo actualizar el usuario en Supabase.', updateError.message);
      return NextResponse.json(
        {
          success: false,
          error: 'No se pudieron guardar los datos del perfil. Si cambiaste correo o contraseña, esas credenciales podrían haberse actualizado.',
        },
        { status: 503 },
      );
    }
    if (!user) {
      return NextResponse.json({ success: false, error: 'No se encontró el usuario.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (updateError) {
    console.error('No se pudo conectar con Supabase para actualizar el usuario.', updateError);
    return NextResponse.json(
      { success: false, error: 'No se pudo conectar con Supabase.' },
      { status: 503 },
    );
  }
}
