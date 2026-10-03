'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type FormErrors = {
  email?: string;
  password?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    const normalizedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Ingresa un correo electrónico válido.';
    }
    if (!password.trim()) {
      nextErrors.password = 'Ingresa tu contraseña.';
    }

    setErrors(nextErrors);
    setAuthError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setAuthError(result.error ?? 'No se pudo iniciar sesión.');
        return;
      }

      router.replace('/dashboard');
    } catch {
      setAuthError('No se pudo conectar con Supabase. Revisa la configuración del proyecto.');
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
        <p className="mb-2 text-sm font-medium text-blue-300">Tu asistente virtual</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">Bienvenido de nuevo</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Inicia sesión para continuar.
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
            aria-describedby={errors.email ? 'email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            type="email"
            value={email}
          />
          {errors.email && (
            <p className="mt-2 text-sm text-rose-300" id="email-error">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-medium text-slate-200">
              Contraseña
            </label>
            <a
              className="text-right text-sm text-blue-300 transition hover:text-blue-200"
              href="#"
              onClick={(event) => event.preventDefault()}
            >
              Olvidé mi contraseña
            </a>
          </div>
          <input
            autoComplete="current-password"
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tu contraseña"
            aria-describedby={errors.password ? 'password-error' : undefined}
            aria-invalid={Boolean(errors.password)}
            type="password"
            value={password}
          />
          {errors.password && (
            <p className="mt-2 text-sm text-rose-300" id="password-error">
              {errors.password}
            </p>
          )}
        </div>

        {authError && (
          <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200" role="alert">
            {authError}
          </p>
        )}

        <button
          className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-[#0b1020] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Entrando...' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="mt-7 text-center text-xs leading-5 text-slate-500">
        <a className="text-blue-300 transition hover:text-blue-200" href="/register">
          Crear una cuenta
        </a>
      </p>
    </section>
  );
}
