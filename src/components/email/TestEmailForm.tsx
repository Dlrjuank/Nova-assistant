'use client';

import { useState, type FormEvent } from 'react';

export function TestEmailForm() {
  const [para, setPara] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensaje('');
    setError('');
    setEnviando(true);

    try {
      const respuesta = await fetch('/api/correo/prueba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ para }),
      });
      const resultado = (await respuesta.json()) as { error?: string };

      if (!respuesta.ok) {
        setError(resultado.error ?? 'No se pudo enviar el correo.');
        return;
      }

      setMensaje('Correo enviado');
    } catch {
      setError('No se pudo conectar con el servidor para enviar el correo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-8">
        <h1 className="text-2xl font-semibold">Prueba de correo</h1>
        <p className="mt-2 text-sm text-slate-400">
          Envía un mensaje de prueba usando la conexión de Resend.
        </p>
        <form className="mt-6 grid gap-4" onSubmit={manejarEnvio}>
          <label className="grid gap-2 text-sm font-medium" htmlFor="para">
            Correo destinatario
            <input
              autoComplete="email"
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
              id="para"
              onChange={(event) => setPara(event.target.value)}
              placeholder="tu@correo.com"
              required
              type="email"
              value={para}
            />
          </label>
          {error && (
            <p className="text-sm text-rose-300" role="alert">
              {error}
            </p>
          )}
          {mensaje && (
            <p className="text-sm text-emerald-300" role="status">
              {mensaje}
            </p>
          )}
          <button
            className="rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={enviando}
            type="submit"
          >
            {enviando ? 'Enviando…' : 'Enviar prueba'}
          </button>
        </form>
      </section>
    </main>
  );
}
