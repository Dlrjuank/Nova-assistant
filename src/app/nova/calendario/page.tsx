import { CalendarioMes } from '@/components/nova/calendario/CalendarioMes';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { exigirSesion, listarCategorias, mesDeTareas } from '@/lib/dataService';
import { nombreMes, sumarMeses } from '@/lib/reglas/calendario';

export const dynamic = 'force-dynamic';

/** Calendario (PLAN_AMPLIACION 5.3, E07). `?mes=YYYY-MM` elige el mes (las flechas lo cambian); sin él, el actual. */
export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const { mes } = await searchParams;
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus tareas (RB-01).
  const { id } = await exigirSesion();
  const [datos, categorias] = await Promise.all([mesDeTareas(id, typeof mes === 'string' ? mes : undefined), listarCategorias(id)]);

  return (
    <>
      <EncabezadoPantalla titulo="Calendario" subtitulo="Tus tareas por fecha límite. Toca un día para ver su lista." />
      <CalendarioMes
        key={datos.mes}
        mes={datos.mes}
        titulo={nombreMes(datos.mes)}
        hoy={datos.hoy}
        semanas={datos.semanas}
        porDia={datos.porDia}
        categorias={categorias}
        anterior={`/nova/calendario?mes=${sumarMeses(datos.mes, -1)}`}
        siguiente={`/nova/calendario?mes=${sumarMeses(datos.mes, 1)}`}
      />
    </>
  );
}
