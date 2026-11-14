import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ConexionNova } from '@/components/nova/ConexionNova';
import { NavegacionNova } from '@/components/nova/NavegacionNova';
import { tieneAccesoNova } from '@/lib/auth/acceso';
import { ProveedorPreferencias } from '@/components/nova/PreferenciasNova';
import { ProveedorPendientes } from '@/components/nova/pendientes/ProveedorPendientes';
import { obtenerPreferencias, obtenerSesion } from '@/lib/dataService';

export const metadata: Metadata = { title: 'Nova Assistant' };
export const dynamic = 'force-dynamic';

export default async function NovaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  if (!tieneAccesoNova(sesion.email)) redirect('/home');
  const preferencias = await obtenerPreferencias(sesion.id); // E11: tema y formato de hora

  // Computador: espacio a la izquierda para la barra lateral (w-64).
  // Teléfono: espacio abajo para la barra inferior y el botón "+". El "+" termina a 5,5rem + 3,5rem = 9rem
  // (más el área segura) del borde; 10rem + el área segura dejan 1rem libre: nunca tapa lo último.
  return (
    <ProveedorPreferencias
      tema={preferencias.tema}
      formatoHora={preferencias.formatoHora}
      horaRecordatorio={preferencias.horaRecordatorio}
    >
      {/* E11e: las tareas creadas sin conexión de este usuario, su envío y el aviso al cerrar sesión. */}
      <ProveedorPendientes usuarioId={sesion.id}>
        <div data-nova-fondo className="min-h-screen bg-fondo text-texto lg:pl-64">
          <NavegacionNova email={sesion.email} />
          <main className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 pt-6 pb-[calc(10rem+var(--nova-seguro-abajo))] lg:px-8 lg:pb-10">
            <ConexionNova />
            {children}
          </main>
        </div>
      </ProveedorPendientes>
    </ProveedorPreferencias>
  );
}
