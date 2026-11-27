import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PanelAdministracion } from '@/components/nova/administracion/PanelAdministracion';
import { accesoDe, obtenerSesion, panelAdministracion } from '@/lib/dataService';
import { destinoSinAcceso, esAdministrador } from '@/lib/reglas/cuentas';

export const metadata: Metadata = { title: 'Administración · Nova Assistant' };
export const dynamic = 'force-dynamic';

/** E20c-2 (RB-83): solo para administradores; para cualquier otra cuenta la página no existe (404). */
export default async function AdministracionPage() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  const acceso = await accesoDe(sesion);
  if (!acceso.permitido) redirect(destinoSinAcceso(acceso.codigo));
  if (!esAdministrador(acceso.nivel)) notFound();
  const panel = await panelAdministracion({ ...sesion, nivel: acceso.nivel });
  return <PanelAdministracion panel={panel} />;
}
