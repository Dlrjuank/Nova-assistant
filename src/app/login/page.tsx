import { LoginForm } from '@/components/login/LoginForm';
import { TEXTO_ERROR_GOOGLE, TEXTO_TOPE_ALCANZADO } from '@/lib/reglas/cuentas';

interface LoginPageProps {
  searchParams: Promise<{ restablecida?: string; error?: string }>;
}

/** E20c-3: `?error=tope` (RB-81) y `?error=google` llegan de /auth/callback. */
const ERRORES: Record<string, string> = { tope: TEXTO_TOPE_ALCANZADO, google: TEXTO_ERROR_GOOGLE, 'auth-confirmation': TEXTO_ERROR_GOOGLE };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const parametros = await searchParams;

  return (
    <LoginForm
      successMessage={
        parametros.restablecida === '1'
          ? 'Tu contraseña se restableció correctamente. Ya puedes iniciar sesión.'
          : undefined
      }
      errorInicial={parametros.error ? ERRORES[parametros.error] : undefined}
    />
  );
}
