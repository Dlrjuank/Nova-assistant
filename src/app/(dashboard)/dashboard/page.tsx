import { notFound, redirect } from 'next/navigation';
import { LogoutButton } from '@/components/login/LogoutButton';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/modules/auth/admin';
import { getCurrentUser } from '@/modules/auth/session';

export const dynamic = 'force-dynamic';

type UserRow = {
  id: string;
  email: string | null;
  created_at: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect('/login');
  }
  if (!isAdminEmail(currentUser.email)) {
    notFound();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error, count } = await supabase
    .from('users')
    .select('id, email, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('No se pudo cargar la lista de usuarios desde Supabase.', error.message);
    throw new Error('No se pudo cargar la lista de usuarios desde Supabase.', { cause: error });
  }

  const users = data as UserRow[];

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

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="flex flex-col gap-1 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-medium">Cuentas de usuario</h2>
            <span className="text-sm text-slate-400">
              {count !== null && count > users.length
                ? `Mostrando las ${users.length} más recientes de ${count}`
                : 'Actualizado desde Supabase'}
            </span>
          </div>
          {users.length === 0 ? (
            <p className="px-6 py-12 text-center text-slate-400">
              Aún no hay usuarios registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Usuario</th>
                    <th className="px-6 py-4 font-medium">ID</th>
                    <th className="px-6 py-4 font-medium">Fecha de registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {users.map((user) => (
                    <tr className="transition hover:bg-white/[0.03]" key={user.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 font-semibold text-blue-100">
                            {(user.email?.[0] ?? '?').toUpperCase()}
                          </span>
                          <span className="font-medium text-slate-100">{user.email ?? 'Sin correo'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{user.id}</td>
                      <td className="px-6 py-4 text-slate-300">
                        <time dateTime={user.created_at}>{formatDate(user.created_at)}</time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="mt-4 text-xs text-slate-500">
          Por seguridad, las contraseñas y credenciales de acceso nunca se muestran en este panel.
        </p>
      </div>
    </main>
  );
}
