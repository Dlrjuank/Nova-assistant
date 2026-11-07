import { RecoveryRequestForm } from '@/components/login/RecoveryRequestForm';
import { CLASE_ENLACE_ACCESO, TarjetaAcceso } from '@/components/login/TarjetaAcceso';

export default function RecuperarContrasenaPage() {
  return (
    <TarjetaAcceso
      titulo="Recuperar contraseña"
      subtitulo="Ingresa el correo asociado a tu cuenta y te enviaremos un enlace para cambiarla."
      pie={
        <a className={CLASE_ENLACE_ACCESO} href="/login">
          Volver al inicio de sesión
        </a>
      }
    >
      <RecoveryRequestForm />
    </TarjetaAcceso>
  );
}
