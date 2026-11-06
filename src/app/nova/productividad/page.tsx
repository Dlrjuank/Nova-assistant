import { TarjetaProductividad } from '@/components/nova/TarjetaProductividad';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { hoyBogota } from '@/lib/reglas/fechas';

export const dynamic = 'force-dynamic';

export default function ProductividadPage() {
  return (
    <>
      <EncabezadoPantalla
        titulo="Productividad"
        subtitulo="Índice del día según las tareas cuya fecha límite es esa fecha: cuántas completaste y cuántos minutos les dedicaste."
      />
      <TarjetaProductividad hoy={hoyBogota()} />
    </>
  );
}
