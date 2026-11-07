import { MiSemana } from '@/components/nova/inicio/MiSemana';
import { PrioridadesHoy } from '@/components/nova/inicio/PrioridadesHoy';
import { ProgresoSemanal } from '@/components/nova/inicio/ProgresoSemanal';
import { PreguntaleANova } from '@/components/nova/PreguntaleANova';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { exigirSesion, listarCategorias, semanaDeTareas } from '@/lib/dataService';
import { semanaDe, sumarDias } from '@/lib/reglas/fechas';
import { prioridadesDeHoy, rangoSemana } from '@/lib/reglas/semana';

export const dynamic = 'force-dynamic';

/**
 * Inicio (PLAN_AMPLIACION 5.1, E06): "Pregúntale a Nova", Mi semana, Progreso semanal y Prioridades de hoy.
 * `?semana=` es cualquier día de la semana a mostrar (las flechas lo cambian); sin él, la actual en Bogotá.
 */
export default async function InicioPage({ searchParams }: { searchParams: Promise<{ semana?: string | string[] }> }) {
  const { semana: pedida } = await searchParams;
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus tareas (RB-01).
  const { id } = await exigirSesion();
  const [semana, categorias] = await Promise.all([
    semanaDeTareas(id, typeof pedida === 'string' ? pedida : undefined),
    listarCategorias(id),
  ]);
  const esActual = semana.lunes === semanaDe(semana.hoy).lunes;

  return (
    <>
      <EncabezadoPantalla titulo="Inicio" subtitulo="Tu semana de un vistazo." />
      <PreguntaleANova />
      <MiSemana
        dias={semana.dias}
        porDia={semana.porDia}
        hoy={semana.hoy}
        rango={rangoSemana(semana.lunes)}
        categorias={categorias}
        anterior={`/nova?semana=${sumarDias(semana.lunes, -7)}`}
        siguiente={`/nova?semana=${sumarDias(semana.lunes, 7)}`}
        actual={esActual ? null : '/nova'}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ProgresoSemanal progreso={semana.progreso} />
        <PrioridadesHoy
          tareas={prioridadesDeHoy(semana.hoyPendientes, semana.hoy)}
          hoy={semana.hoy}
          vencidas={semana.vencidas}
          categorias={categorias}
        />
      </div>
    </>
  );
}
