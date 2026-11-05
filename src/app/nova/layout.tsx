import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { NavegacionNova } from '@/components/nova/NavegacionNova';
import { Aviso } from '@/components/ui/Aviso';
import { tieneAccesoNova } from '@/lib/auth/acceso';
import { obtenerSesion } from '@/lib/dataService';

export const metadata: Metadata = { title: 'Nova Assistant' };
export const dynamic = 'force-dynamic';

export default async function NovaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  if (!tieneAccesoNova(sesion.email)) redirect('/home');

  return (
    <div className="min-h-screen bg-fondo text-texto">
      <NavegacionNova email={sesion.email} />
      <main className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-6">
        <Aviso tipo="info">
          Tus preguntas y los fragmentos recuperados se envían al proveedor del asistente. No subas documentos con
          datos sensibles.
        </Aviso>
        {children}
      </main>
    </div>
  );
}
