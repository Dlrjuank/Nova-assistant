import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SalirDeCuenta } from '@/components/login/SalirDeCuenta';
import { TarjetaAcceso } from '@/components/login/TarjetaAcceso';
import { accesoDe, obtenerSesion } from '@/lib/dataService';
import { MENSAJES } from '@/lib/reglas/errores';

export const metadata: Metadata = { title: 'Tu cuenta · Nova Assistant' };
export const dynamic = 'force-dynamic';

/**
 * E20c-2 (RB-82, RB-92): adonde llega una sesión cuya cuenta no entra a Nova. Dice por qué (pendiente de que el
 * administrador la habilite, o bloqueada) y deja cerrar sesión. Si la cuenta ya entra, va a Nova.
 */
export default async function CuentaPage() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  const acceso = await accesoDe(sesion);
  if (acceso.permitido) redirect('/nova');
  if (acceso.codigo === 'DEBE_CAMBIAR_CONTRASENA') redirect('/cambiar-contrasena');
  const bloqueada = acceso.codigo === 'CUENTA_BLOQUEADA';
  return (
    <TarjetaAcceso titulo={bloqueada ? 'Cuenta bloqueada' : 'Cuenta en espera'} subtitulo={sesion.email}>
      <div className="flex flex-col gap-6">
        <p role="status" className="rounded-xl border border-borde bg-superficie-2 px-4 py-3 text-sm leading-6 text-texto" data-estado-cuenta={bloqueada ? 'bloqueada' : 'pendiente'}>
          {MENSAJES[acceso.codigo]}
        </p>
        <SalirDeCuenta />
      </div>
    </TarjetaAcceso>
  );
}
