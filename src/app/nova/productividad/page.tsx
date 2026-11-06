import { TarjetaProductividad } from '@/components/nova/TarjetaProductividad';
import { hoyBogota } from '@/lib/reglas/fechas';

export const dynamic = 'force-dynamic';

export default function ProductividadPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Productividad</h1>
      <p className="text-sm text-texto-suave">
        Índice del día según las tareas cuya fecha límite es esa fecha: cuántas completaste y cuántos minutos les dedicaste.
      </p>
      <TarjetaProductividad hoy={hoyBogota()} />
    </>
  );
}
