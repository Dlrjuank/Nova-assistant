import { UserPortal } from '@/components/home/UserPortal';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/modules/auth/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from('users')
    .select('full_name, phone')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('No se pudo cargar el perfil del usuario.', error.message);
    throw new Error('No se pudo cargar el perfil del usuario.', { cause: error });
  }

  return (
    <UserPortal email={user.email ?? ''} fullName={profile?.full_name ?? null} phone={profile?.phone ?? null} />
  );
}
