import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

// Plan, sección 4: sin sesión va al login; con sesión, a Nova. E20c-2: si la cuenta no entra (pendiente o
// bloqueada), el layout de Nova la lleva a /cuenta.
export default async function HomePage() {
  const sesion = await obtenerSesion();
  redirect(sesion ? '/nova' : '/login');
}
