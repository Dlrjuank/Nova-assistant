'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface PasswordResetFormProps {
  token: string;
}

export function PasswordResetForm({ token }: PasswordResetFormProps) {
  const router = useRouter();
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (contrasena !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/restablecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, contrasena, confirmacion }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? 'No se pudo cambiar la contraseña.');
        return;
      }

      router.replace('/login?restablecida=1');
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <div>
        <label htmlFor="contrasena" className="mb-2 block text-sm font-medium text-slate-200">
          Nueva contraseña
        </label>
        <input
          autoComplete="new-password"
          className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          id="contrasena"
          minLength={8}
          onChange={(event) => setContrasena(event.target.value)}
          required
          type="password"
          value={contrasena}
        />
      </div>
      <div>
        <label htmlFor="confirmacion" className="mb-2 block text-sm font-medium text-slate-200">
          Confirmar contraseña
        </label>
        <input
          autoComplete="new-password"
          className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          id="confirmacion"
          minLength={8}
          onChange={(event) => setConfirmacion(event.target.value)}
          required
          type="password"
          value={confirmacion}
        />
      </div>
      {error && (
        <p
          className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}
      <button
        className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-[#0b1020] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Actualizando…' : 'Restablecer contraseña'}
      </button>
    </form>
  );
}
