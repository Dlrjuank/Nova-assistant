import { MetasSemanales } from '@/components/nova/MetasSemanales';
import { TarjetaProductividad } from '@/components/nova/TarjetaProductividad';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { exigirSesion, listarCategorias, listarMetasSemanales } from '@/lib/dataService';
import { hoyBogota } from '@/lib/reglas/fechas';

export const dynamic = 'force-dynamic';

export default async function ProductividadPage() {
  const sesion = await exigirSesion();
  // E15 (5.6): debajo del índice del día, las metas semanales con el progreso de esta semana.
  const [semana, categorias] = await Promise.all([listarMetasSemanales(sesion.id), listarCategorias(sesion.id)]);
  return (
    <>
      <EncabezadoPantalla
        titulo="Productividad"
        subtitulo="Índice del día según las tareas cuya fecha límite es esa fecha: cuántas completaste y cuántos minutos les dedicaste."
      />
      <div className="flex flex-col gap-6">
        <TarjetaProductividad hoy={hoyBogota()} />
        <MetasSemanales semana={semana} categorias={categorias.map((c) => c.nombre)} />
      </div>
    </>
  );
}
