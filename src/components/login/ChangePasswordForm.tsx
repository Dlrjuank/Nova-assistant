'use client';

import { useState, type FormEvent } from 'react';

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? 'No se pudo cambiar la contraseña.');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Tu contraseña se actualizó correctamente.');
    } catch {
      setError('No se pudo conectar con el servidor para cambiar la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <details className="max-w-sm rounded-xl border border-white/15 bg-slate-950/40 text-left text-white">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-white/5">
        Cambiar contraseña
      </summary>
      <form className="grid gap-3 border-t border-white/10 p-4" onSubmit={handleSubmit}>
        <label className="grid gap-1 text-xs text-slate-300">
          Contraseña actual
          <input
            autoComplete="current-password"
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
            maxLength={128}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type="password"
            value={currentPassword}
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-300">
          Nueva contraseña
          <input
            autoComplete="new-password"
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
            maxLength={128}
            minLength={8}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-300">
          Confirmar nueva contraseña
          <input
            autoComplete="new-password"
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
            maxLength={128}
            minLength={8}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </label>
        {error && <p className="text-sm text-rose-200" role="alert">{error}</p>}
        {message && <p className="text-sm text-emerald-200" role="status">{message}</p>}
        <button
          className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Actualizando…' : 'Actualizar contraseña'}
        </button>
      </form>
    </details>
  );
}
