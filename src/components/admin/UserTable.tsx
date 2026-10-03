'use client';

import { useState, type FormEvent } from 'react';

export interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

interface UserTableProps {
  users: AdminUser[];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function UserTable({ users: initialUsers }: UserTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  function startEditing(user: AdminUser) {
    setEditingId(user.id);
    setFullName(user.full_name ?? '');
    setPhone(user.phone ?? '');
    setError('');
  }

  async function saveUser(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setSavingId(id);
    setError('');

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, phone }),
      });
      const result = (await response.json()) as { data?: AdminUser; error?: string };

      if (!response.ok || !result.data) {
        setError(result.error ?? 'No se pudo guardar el usuario.');
        return;
      }

      setUsers((currentUsers) =>
        currentUsers.map((user) => (user.id === id ? result.data! : user)),
      );
      setEditingId(null);
    } catch {
      setError('No se pudo conectar con el servidor para guardar los cambios.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="flex flex-col gap-1 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-medium">Cuentas de usuario</h2>
        <span className="text-sm text-slate-400">Actualizado desde Supabase</span>
      </div>
      {error && (
        <p className="border-b border-rose-400/20 bg-rose-400/10 px-6 py-3 text-sm text-rose-200" role="alert">
          {error}
        </p>
      )}
      {users.length === 0 ? (
        <p className="px-6 py-12 text-center text-slate-400">Aún no hay usuarios registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Usuario</th>
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Fecha de registro</th>
                <th className="px-6 py-4 font-medium">Acción</th>
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
                      {editingId === user.id ? (
                        <form
                          className="grid w-full max-w-sm gap-2"
                          id={`edit-user-${user.id}`}
                          onSubmit={(event) => saveUser(event, user.id)}
                        >
                          <span className="font-medium text-slate-100">{user.email ?? 'Sin correo'}</span>
                          <label className="grid gap-1 text-xs text-slate-400">
                            Nombre
                            <input
                              className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                              maxLength={120}
                              onChange={(event) => setFullName(event.target.value)}
                              value={fullName}
                            />
                          </label>
                          <label className="grid gap-1 text-xs text-slate-400">
                            Teléfono
                            <input
                              className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                              maxLength={40}
                              onChange={(event) => setPhone(event.target.value)}
                              type="tel"
                              value={phone}
                            />
                          </label>
                        </form>
                      ) : (
                        <div>
                          <p className="font-medium text-slate-100">{user.full_name || user.email || 'Sin nombre'}</p>
                          <p className="text-xs text-slate-400">{user.email ?? 'Sin correo'}</p>
                          <p className="text-xs text-slate-500">{user.phone || 'Sin teléfono'}</p>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">{user.id}</td>
                  <td className="px-6 py-4 text-slate-300">
                    <time dateTime={user.created_at}>{formatDate(user.created_at)}</time>
                  </td>
                  <td className="px-6 py-4">
                    {editingId === user.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-400 disabled:opacity-50"
                          disabled={savingId === user.id}
                          form={`edit-user-${user.id}`}
                          type="submit"
                        >
                          {savingId === user.id ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10"
                          onClick={() => setEditingId(null)}
                          type="button"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="rounded-lg border border-white/15 px-3 py-2 text-xs text-blue-200 transition hover:bg-white/10"
                        onClick={() => startEditing(user)}
                        type="button"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-white/[0.07] px-6 py-4 text-xs text-slate-500">
        El correo y la contraseña se gestionan en Supabase Auth y no se editan aquí.
      </p>
    </section>
  );
}
