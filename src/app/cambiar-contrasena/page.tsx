import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioContrasenaNueva } from '@/components/login/FormularioContrasenaNueva';
import { SalirDeCuenta } from '@/components/login/SalirDeCuenta';
import { TarjetaAcceso } from '@/components/login/TarjetaAcceso';
import { accesoDe, obtenerSesion } from '@/lib/dataService';
import { TEXTO_DEBE_CAMBIAR } from '@/lib/reglas/cuentas';

export const metadata: Metadata = { title: 'Contraseña nueva · Nova Assistant' };
export const dynamic = 'force-dynamic';

/**
 * E20c-3 (RB-91): después de entrar con la contraseña temporal solo se puede ver esta pantalla, hasta poner una
 * propia. Una cuenta que no debe cambiarla va a Nova (o a /cuenta si no entra).
 */
export default async function CambiarContrasenaPage() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  const acceso = await accesoDe(sesion);
  if (acceso.permitido) redirect('/nova');
  if (acceso.codigo !== 'DEBE_CAMBIAR_CONTRASENA') redirect('/cuenta');
  return (
    <TarjetaAcceso titulo="Pon una contraseña nueva" subtitulo={sesion.email}>
      <div className="flex flex-col gap-6">
        <p role="status" className="rounded-xl border border-borde bg-superficie-2 px-4 py-3 text-sm leading-6 text-texto">
          {TEXTO_DEBE_CAMBIAR} La temporal ya no sirve para volver a entrar.
        </p>
        <FormularioContrasenaNueva pideActual={false} alTerminar="nova" />
        <SalirDeCuenta />
      </div>
    </TarjetaAcceso>
  );
}
