import Link from 'next/link';
import { PasswordResetForm } from '@/components/login/PasswordResetForm';

interface RestablecerContrasenaPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function RestablecerContrasenaPage({
  searchParams,
}: RestablecerContrasenaPageProps) {
  const parametros = await searchParams;
  const token = typeof parametros.token === 'string' ? parametros.token : '';
  const tokenValido = /^[a-f0-9]{64}$/i.test(token);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(120deg,#0f0c29,#302b63,#24243e)] px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,#60a5fa_0,transparent_32%),radial-gradient(circle_at_85%_80%,#a78bfa_0,transparent_35%)] opacity-20"
      />
      <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1020]/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-blue-300">NovaAssistant</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Nueva contraseña</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Elige una contraseña nueva para tu cuenta.
          </p>
        </div>
        {tokenValido ? (
          <PasswordResetForm token={token} />
        ) : (
          <div>
            <p
              className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
              role="alert"
            >
              El enlace no es válido o ya venció.
            </p>
            <Link
              className="mt-5 inline-block text-sm text-blue-300 transition hover:text-blue-200"
              href="/recuperar-contrasena"
            >
              Solicitar otro enlace
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
