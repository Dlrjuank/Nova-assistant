import { EntrarConGoogle } from '@/components/login/EntrarConGoogle';
import { CLASE_ENLACE_ACCESO, TarjetaAcceso } from '@/components/login/TarjetaAcceso';

/**
 * E20c-3 (plan 5.14): el correo de recuperación solo llega al dueño de la cuenta de Resend (no hay dominio
 * verificado), así que esta pantalla explica las dos salidas que sí funcionan: Google o una contraseña temporal del
 * administrador. El envío por correo queda para el día que haya dominio (RecoveryRequestForm sigue en el código).
 */
export default function RecuperarContrasenaPage() {
  return (
    <TarjetaAcceso
      titulo="¿Olvidaste tu contraseña?"
      subtitulo="Tienes dos formas de volver a entrar."
      pie={
        <a className={CLASE_ENLACE_ACCESO} href="/login">
          Volver al inicio de sesión
        </a>
      }
    >
      <ol className="flex flex-col gap-6" data-salidas-contrasena>
        <li className="flex flex-col gap-3">
          <p className="text-sm leading-6 text-texto">
            <span className="font-semibold">Con Google.</span> Si tu cuenta es de un correo de Google, entra con él: no necesitas la contraseña. Después
            puedes poner una nueva en Configuración → Sesión.
          </p>
          <EntrarConGoogle separador={false} />
        </li>
        <li className="text-sm leading-6 text-texto">
          <span className="font-semibold">Con el administrador.</span> Pídele una contraseña temporal. Sirve para entrar una sola vez en las
          siguientes 24 horas y, al entrar, pones una tuya.
        </li>
      </ol>
    </TarjetaAcceso>
  );
}
