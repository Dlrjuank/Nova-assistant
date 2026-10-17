import { redirect } from 'next/navigation';
import { UserTable, type AdminUser } from '@/components/admin/UserTable';
import { ChangePasswordForm } from '@/components/login/ChangePasswordForm';
import { LogoutButton } from '@/components/login/LogoutButton';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/modules/auth/admin';
import { getCurrentUser } from '@/modules/auth/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect('/login');
  }
  if (!isAdminEmail(currentUser.email)) {
    redirect('/home');
  }

  const supabase = createSupabaseAdminClient();
  const { data, error, count } = await supabase
    .from('users')
    .select('id, email, full_name, phone, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('No se pudo cargar la lista de usuarios desde Supabase.', error.message);
    throw new Error('No se pudo cargar la lista de usuarios desde Supabase.', { cause: error });
  }

  const users = data as AdminUser[];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-4 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-mono text-sm uppercase tracking-[0.2em] text-blue-300">
              NovaAssistant · Administración
            </p>
            <h1 className="text-4xl font-semibold tracking-tight">Usuarios</h1>
            <p className="mt-2 text-sm text-slate-400">
              Directorio de cuentas registradas en Supabase.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-400 sm:inline">{currentUser.email}</span>
            <ChangePasswordForm />
            <LogoutButton />
          </div>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Usuarios registrados</p>
            <p className="mt-2 text-3xl font-semibold">{count ?? users.length}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Mostrando</p>
            <p className="mt-2 text-3xl font-semibold">{users.length}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Origen de datos</p>
            <p className="mt-2 text-3xl font-semibold">Supabase</p>
          </article>
        </section>

        <UserTable users={users as AdminUser[]} />
        <p className="mt-4 text-xs text-slate-500">
          Las contraseñas actuales nunca se muestran; puedes asignar una nueva desde la edición de cada cuenta.
        </p>
      </div>
    </main>
  );
}
