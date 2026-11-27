import { Suspense } from 'react';
import { ComparacionMaterias, EvolucionPorCorte, MateriasEnRiesgo, ResumenEstadisticas } from '@/components/nova/semestre/GraficosEstadisticas';
import { NuevaMateria } from '@/components/nova/semestre/NuevaMateria';
import { pestanasSemestre } from '@/components/nova/semestre/pestanas';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { estadisticasSemestre, exigirSesionDePagina } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

/** Los datos y los gráficos, que llegan después del encabezado y las pestañas. */
async function Contenido({ usuarioId }: { usuarioId: string }) {
  const datos = await estadisticasSemestre(usuarioId);
  if (datos.materias.length === 0) {
    return <EstadoVacio titulo="Aún no tienes materias." descripcion="Crea una materia y registra tus notas para ver sus estadísticas." accion={<NuevaMateria />} />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ResumenEstadisticas datos={datos} />
      <MateriasEnRiesgo datos={datos} />
      <ComparacionMaterias datos={datos} />
      <EvolucionPorCorte datos={datos} />
    </div>
  );
}

/**
 * E20 (5.7, B-40): evolución por corte, comparación entre materias y materias en riesgo.
 * El contenido va en su propio Suspense: con la pantalla entera en una sola respuesta, al llegar desde otra
 * pestaña de Semestre la navegación a veces no terminaba (solo en producción; ver ESTADO_EJECUCION, E20).
 */
export default async function EstadisticasPage() {
  const sesion = await exigirSesionDePagina();
  return (
    <>
      <EncabezadoPantalla titulo="Semestre" subtitulo="Cómo van tus notas por corte, cómo se comparan tus materias y cuáles están en riesgo." />
      <Pestanas etiqueta="Secciones de Semestre" pestanas={pestanasSemestre('estadisticas')} />
      <Suspense fallback={<p className="text-sm text-texto-suave">Calculando tus estadísticas…</p>}>
        <Contenido usuarioId={sesion.id} />
      </Suspense>
    </>
  );
}
