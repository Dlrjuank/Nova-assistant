'use client';

import { useState, type FormEvent } from 'react';

export function RecoveryRequestForm() {
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensaje('');
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = (await response.json()) as { mensaje?: string; error?: string };

      if (!response.ok) {
        setError(result.error ?? 'No se pudo procesar la solicitud.');
        return;
      }

      setMensaje(
        result.mensaje ??
          'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.',
      );
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
          Correo electrónico
        </label>
        <input
          autoComplete="email"
          className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@correo.com"
          required
          type="email"
          value={email}
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
      {mensaje && (
        <p
          className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
          role="status"
        >
          {mensaje}
        </p>
      )}
      <button
        className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-[#0b1020] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
      </button>
    </form>
  );
}
