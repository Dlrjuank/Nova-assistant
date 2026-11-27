import { MiSemana } from '@/components/nova/inicio/MiSemana';
import { PrioridadesHoy } from '@/components/nova/inicio/PrioridadesHoy';
import { ProgresoSemanal } from '@/components/nova/inicio/ProgresoSemanal';
import { ProximoCorte, SaludoInicio, TarjetasInicio } from '@/components/nova/inicio/ResumenInicio';
import { PreguntaleANova } from '@/components/nova/PreguntaleANova';
import { exigirSesionDePagina, listarCategorias, resumenInicio, semanaDeTareas } from '@/lib/dataService';
import { hoyBogota, semanaDe, sumarDias } from '@/lib/reglas/fechas';
import { horaBogota } from '@/lib/reglas/inicio';
import { prioridadesDeHoy, rangoSemana } from '@/lib/reglas/semana';

export const dynamic = 'force-dynamic';

/**
 * Inicio (PLAN_AMPLIACION 5.1, E06): "Pregúntale a Nova", Mi semana, Progreso semanal y Prioridades de hoy.
 * `?semana=` es cualquier día de la semana a mostrar (las flechas lo cambian); sin él, la actual en Bogotá.
 * E20b (commit 2): en mosaico. Arriba el saludo según la hora con un resumen corto del día y "Pregúntale a Nova";
 * luego cuatro tarjetas con números que cuentan (tareas de hoy, vencidas, tiempo de la semana y promedio); Mi
 * semana a lo ancho; y el progreso, las prioridades de hoy y el próximo corte.
 */
export default async function InicioPage({ searchParams }: { searchParams: Promise<{ semana?: string | string[] }> }) {
  const { semana: pedida } = await searchParams;
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus tareas (RB-01).
  const { id } = await exigirSesionDePagina();
  // E20b (tiempo de carga): las tres a la vez; el resumen solo necesita la fecha de hoy, no la semana.
  const [semana, categorias, resumen] = await Promise.all([
    semanaDeTareas(id, typeof pedida === 'string' ? pedida : undefined),
    listarCategorias(id),
    resumenInicio(id, hoyBogota()),
  ]);
  const esActual = semana.lunes === semanaDe(semana.hoy).lunes;

  return (
    <>
      <SaludoInicio nombre={resumen.nombre} hora={horaBogota()} hoy={semana.hoy} pendientesHoy={resumen.hoy.pendientes} vencidas={semana.vencidas} />
      <PreguntaleANova />
      <TarjetasInicio
        resumen={resumen}
        hoy={semana.hoy}
        hoyTotal={resumen.hoy.total}
        hoyPendientes={resumen.hoy.pendientes}
        hoyConHorario={resumen.hoy.conHorario}
        vencidas={semana.vencidas}
      />
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
      <div className={`grid items-start gap-4 md:grid-cols-2 ${resumen.proximoCorte ? 'lg:grid-cols-3' : ''}`}>
        <ProgresoSemanal progreso={semana.progreso} />
        <PrioridadesHoy tareas={prioridadesDeHoy(semana.hoyPendientes, semana.hoy)} hoy={semana.hoy} vencidas={semana.vencidas} categorias={categorias} />
        {resumen.proximoCorte && <ProximoCorte corte={resumen.proximoCorte} hoy={semana.hoy} />}
      </div>
    </>
  );
}
