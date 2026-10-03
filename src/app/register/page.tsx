import { RegisterForm } from '@/components/login/RegisterForm';

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(120deg,#0f0c29,#302b63,#24243e)] px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,#60a5fa_0,transparent_32%),radial-gradient(circle_at_85%_80%,#a78bfa_0,transparent_35%)] opacity-20"
      />
      <RegisterForm />
    </main>
  );
}
