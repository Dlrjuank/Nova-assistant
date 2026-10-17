import Link from 'next/link';
import { RecoveryRequestForm } from '@/components/login/RecoveryRequestForm';

export default function RecuperarContrasenaPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(120deg,#0f0c29,#302b63,#24243e)] px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,#60a5fa_0,transparent_32%),radial-gradient(circle_at_85%_80%,#a78bfa_0,transparent_35%)] opacity-20"
      />
      <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1020]/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-blue-300">NovaAssistant</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Recuperar contraseña</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Ingresa el correo asociado a tu cuenta y te enviaremos un enlace para cambiarla.
          </p>
        </div>
        <RecoveryRequestForm />
        <p className="mt-7 text-center text-xs leading-5 text-slate-500">
          <Link className="text-blue-300 transition hover:text-blue-200" href="/login">
            Volver al inicio de sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
