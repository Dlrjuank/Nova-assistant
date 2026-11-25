import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Celebracion } from '@/components/nova/Celebracion';
import { ConexionNova } from '@/components/nova/ConexionNova';
import { NavegacionNova } from '@/components/nova/NavegacionNova';
import { PantallaCarga } from '@/components/nova/PantallaCarga';
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

  // Computador: espacio a la izquierda para la barra lateral flotante (E20b: su ancho cambia al plegarla).
  // Teléfono: espacio abajo para la barra inferior y el botón "+". El "+" termina a 5,5rem + 3,5rem = 9rem
  // (más el área segura) del borde; E20b: 12rem + el área segura dejan 3rem libres al bajar del todo (el
  // usuario vio el "+" y la barra tapando lo último en el iPhone).
  return (
    <ProveedorPreferencias
      tema={preferencias.tema}
      formatoHora={preferencias.formatoHora}
      horaRecordatorio={preferencias.horaRecordatorio}
    >
      {/* E11e: las tareas creadas sin conexión de este usuario, su envío y el aviso al cerrar sesión. */}
      <ProveedorPendientes usuarioId={sesion.id}>
        {/* E20b: la Estrella nova mientras carga, solo al abrir la app en frío (se oculta sola). */}
        <PantallaCarga />
        <div data-nova-fondo className="min-h-screen bg-fondo text-texto lg:pl-[calc(var(--nova-ancho-lateral)+1.5rem)] lg:transition-[padding] lg:duration-200">
          <NavegacionNova email={sesion.email} />
          {/* E20b: nova-entrada hace que los bloques de cada pantalla entren escalonados (globals.css). */}
          <main className="nova-entrada mx-auto flex max-w-[1000px] flex-col gap-6 px-4 pt-6 pb-[calc(12rem+var(--nova-seguro-abajo))] lg:px-8 lg:pb-10">
            <ConexionNova />
            {children}
          </main>
          {/* E20b (commit 3): el aviso al completar una tarea, fuera de <main> para no entrar en su escalonado. */}
          <Celebracion />
        </div>
      </ProveedorPendientes>
    </ProveedorPreferencias>
  );
}
