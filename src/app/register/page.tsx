import { EntrarConGoogle } from '@/components/login/EntrarConGoogle';
import { CLASE_ENLACE_ACCESO, TarjetaAcceso } from '@/components/login/TarjetaAcceso';
import { TEXTO_REGISTRO_GOOGLE } from '@/lib/reglas/cuentas';

/**
 * E20c-3 (RB-81): las cuentas nuevas se crean con "Entrar con Google" (pasan el gancho del tope de cuentas y nacen
 * activas). El registro con correo ya no crea cuentas; el correo y la contraseña quedan para quien ya los tiene.
 */
export default function RegisterPage() {
  return (
    <TarjetaAcceso
      titulo="Crear una cuenta"
      subtitulo={TEXTO_REGISTRO_GOOGLE}
      pie={
        <a className={CLASE_ENLACE_ACCESO} href="/login">
          Ya tengo cuenta: iniciar sesión
        </a>
      }
    >
      <div className="flex flex-col gap-4">
        <EntrarConGoogle separador={false} />
        <p className="text-xs leading-5 text-texto-suave">
          Con tu cuenta de Google entras sin crear una contraseña. Si quieres una, la pones después en Configuración.
        </p>
      </div>
    </TarjetaAcceso>
  );
}
