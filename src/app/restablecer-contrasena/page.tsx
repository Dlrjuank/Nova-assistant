import { PasswordResetForm } from '@/components/login/PasswordResetForm';
import { CLASE_ENLACE_ACCESO, CLASE_ERROR_ACCESO, TarjetaAcceso } from '@/components/login/TarjetaAcceso';

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
    <TarjetaAcceso titulo="Nueva contraseña" subtitulo="Elige una contraseña nueva para tu cuenta.">
      {tokenValido ? (
        <PasswordResetForm token={token} />
      ) : (
        <div>
          <p className={CLASE_ERROR_ACCESO} role="alert">
            El enlace no es válido o ya venció.
          </p>
          <a className={`mt-5 inline-block text-sm ${CLASE_ENLACE_ACCESO}`} href="/recuperar-contrasena">
            Solicitar otro enlace
          </a>
        </div>
      )}
    </TarjetaAcceso>
  );
}
