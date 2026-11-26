import { TEXTO_REGISTRO_CERRADO } from '@/lib/auth/registro';

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(120deg,#0f0c29,#302b63,#24243e)] px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,#60a5fa_0,transparent_32%),radial-gradient(circle_at_85%_80%,#a78bfa_0,transparent_35%)] opacity-20"
      />
      <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1020]/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
        <div className="mb-8 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-white">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-violet-500 text-lg">
            ✦
          </span>
          NovaAssistant
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Crear cuenta</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300" role="status">
          {TEXTO_REGISTRO_CERRADO}
        </p>
        <p className="mt-7 text-center text-sm text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <a className="text-blue-300 transition hover:text-blue-200" href="/login">
            Inicia sesión
          </a>
        </p>
      </section>
    </main>
  );
}
