import { redirect } from 'next/navigation';
import { tieneAccesoNova } from '@/lib/auth/acceso';
import { obtenerSesion } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

// Plan, sección 4: sin sesión va al login; con sesión, a Nova (o a /home si la cuenta no tiene acceso a Nova).
export default async function HomePage() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  redirect(tieneAccesoNova(sesion.email) ? '/nova' : '/home');
}
