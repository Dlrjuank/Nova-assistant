'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8 || password.length > 128) {
      setError('La contraseña debe tener entre 8 y 128 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = (await response.json()) as {
        error?: string;
        data?: { requiresEmailConfirmation?: boolean };
      };

      if (!response.ok) {
        setError(result.error ?? 'No se pudo crear la cuenta.');
        return;
      }

      if (result.data?.requiresEmailConfirmation) {
        setSuccess('Revisa tu correo y confirma la cuenta para poder iniciar sesión.');
        return;
      }

      router.replace('/dashboard');
    } catch {
      setError('No se pudo conectar con Supabase. Revisa la configuración del proyecto.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1020]/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
      <div className="mb-8">
        <div className="mb-8 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-white">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-violet-500 text-lg">
            ✦
          </span>
          NovaAssistant
        </div>
        <p className="mb-2 text-sm font-medium text-blue-300">Cuenta de Supabase</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">Crear cuenta</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Tu cuenta se administrará de forma segura con Supabase Auth.
        </p>
      </div>

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
            Correo electrónico
          </label>
          <input
            autoComplete="email"
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            id="email"
            inputMode="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
            required
            type="email"
            value={email}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">
            Contraseña
          </label>
          <input
            autoComplete="new-password"
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
            type="password"
            value={password}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-200">
            Confirmar contraseña
          </label>
          <input
            autoComplete="new-password"
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            id="confirm-password"
            name="confirm-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200" role="status">
            {success}
          </p>
        )}

        <button
          className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-[#0b1020] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-400">
        ¿Ya tienes cuenta?{' '}
        <a className="text-blue-300 transition hover:text-blue-200" href="/login">
          Inicia sesión
        </a>
      </p>
    </section>
  );
}
