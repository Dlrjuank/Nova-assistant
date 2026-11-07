import { LoginForm } from '@/components/login/LoginForm';

interface LoginPageProps {
  searchParams: Promise<{ restablecida?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const parametros = await searchParams;

  return (
    <LoginForm
      successMessage={
        parametros.restablecida === '1'
          ? 'Tu contraseña se restableció correctamente. Ya puedes iniciar sesión.'
          : undefined
      }
    />
  );
}
