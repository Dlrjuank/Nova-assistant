import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Celebracion } from '@/components/nova/Celebracion';
import { ConexionNova } from '@/components/nova/ConexionNova';
import { ConservarScroll } from '@/components/nova/ConservarScroll';
import { NavegacionNova } from '@/components/nova/NavegacionNova';
import { PantallaCarga } from '@/components/nova/PantallaCarga';
import { ProveedorPreferencias } from '@/components/nova/PreferenciasNova';
import { ProveedorPendientes } from '@/components/nova/pendientes/ProveedorPendientes';
import { accesoDe, estadoIa, obtenerPreferencias, obtenerSesion } from '@/lib/dataService';
import { esAdministrador } from '@/lib/reglas/cuentas';

export const metadata: Metadata = { title: 'Nova Assistant' };
export const dynamic = 'force-dynamic';

export default async function NovaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  // E11: tema y formato de hora. E20c-1: qué IA tiene (para el aviso de RB-79 en lugar de los botones de IA).
  // E20c-2 (RB-92, RB-93): si entra lo decide la fila de `cuentas`, revisada en cada pedido; si no, /cuenta lo explica.
  const [acceso, preferencias, ia] = await Promise.all([accesoDe(sesion), obtenerPreferencias(sesion.id), estadoIa(sesion.id)]);
  if (!acceso.permitido) redirect(acceso.codigo === 'DEBE_CAMBIAR_CONTRASENA' ? '/cambiar-contrasena' : '/cuenta');
  // RB-83: para quien no es administrador, "Administración" no existe (404 de verdad: aquí aún no se envió nada).
  const ruta = (await headers()).get('x-nova-ruta') ?? '';
  if ((ruta === '/nova/administracion' || ruta.startsWith('/nova/administracion/')) && !esAdministrador(acceso.nivel)) notFound();

  // Computador: espacio a la izquierda para la barra lateral flotante (E20b: su ancho cambia al plegarla).
  // Teléfono: espacio abajo para la barra inferior y el botón "+". El "+" termina a 5,5rem + 3,5rem = 9rem
  // (más el área segura) del borde; E20b: 12rem + el área segura dejan 3rem libres al bajar del todo (el
  // usuario vio el "+" y la barra tapando lo último en el iPhone).
  return (
    <ProveedorPreferencias
      tema={preferencias.tema}
      formatoHora={preferencias.formatoHora}
      horaRecordatorio={preferencias.horaRecordatorio}
      estadoIa={ia}
    >
      {/* E11e: las tareas creadas sin conexión de este usuario, su envío y el aviso al cerrar sesión. */}
      <ProveedorPendientes usuarioId={sesion.id}>
        {/* E20b: la Estrella nova mientras carga, solo al abrir la app en frío (se oculta sola). */}
        <PantallaCarga />
        <div data-nova-fondo className="min-h-screen bg-fondo text-texto lg:pl-[calc(var(--nova-ancho-lateral)+1.5rem)] lg:transition-[padding] lg:duration-200">
          <NavegacionNova email={sesion.email} administrador={esAdministrador(acceso.nivel)} />
          {/* E20b: nova-entrada hace que los bloques de cada pantalla entren escalonados (globals.css). */}
          <main className="nova-entrada mx-auto flex max-w-[1000px] flex-col gap-6 px-4 pt-6 pb-[calc(12rem+var(--nova-seguro-abajo))] lg:px-8 lg:pb-10">
            <ConexionNova />
            {children}
          </main>
          {/* E20b (commit 3): el aviso al completar una tarea, fuera de <main> para no entrar en su escalonado. */}
          <Celebracion />
          {/* Filtros y pestañas de la misma pantalla: la página no sube (pedido del usuario del 2026-11-26). */}
          <Suspense fallback={null}>
            <ConservarScroll />
          </Suspense>
        </div>
      </ProveedorPendientes>
    </ProveedorPreferencias>
  );
}
