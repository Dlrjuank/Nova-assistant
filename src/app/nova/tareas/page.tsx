import Link from 'next/link';
import { TablaTareas } from '@/components/nova/TablaTareas';
import { claseBoton } from '@/components/ui/Boton';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { exigirSesion, listarTareas, type EstadoTarea } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

const FILTROS: Array<{ valor: EstadoTarea | undefined; texto: string }> = [
  { valor: undefined, texto: 'Todas' },
  { valor: 'Pendiente', texto: 'Pendientes' },
  { valor: 'Completada', texto: 'Completadas' },
];

function estadoValido(valor: string | undefined): EstadoTarea | undefined {
  return valor === 'Pendiente' || valor === 'En Progreso' || valor === 'Completada' ? valor : undefined;
}

export default async function TareasPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const estado = estadoValido((await searchParams).estado);
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus tareas (RB-01).
  const { id } = await exigirSesion();
  const tareas = await listarTareas(id, { estado });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tareas</h1>
        <Link href="/nova/tareas/nueva" className={claseBoton('primario')}>
          Registrar tarea
        </Link>
      </div>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {FILTROS.map(({ valor, texto }) => {
          const activo = valor === estado;
          return (
            <Link
              key={texto}
              href={valor ? `/nova/tareas?estado=${encodeURIComponent(valor)}` : '/nova/tareas'}
              aria-current={activo ? 'true' : undefined}
              className={`rounded-full border px-3 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario ${activo ? 'border-primario bg-primario text-white' : 'border-borde bg-superficie text-texto hover:bg-primario-suave'}`}
            >
              {texto}
            </Link>
          );
        })}
      </nav>

      {tareas.length === 0 ? (
        <EstadoVacio
          titulo={estado ? `No hay tareas ${estado === 'Pendiente' ? 'pendientes' : estado.toLowerCase() + 's'}` : 'Aún no tienes tareas'}
          descripcion="Registra una tarea y aparecerá aquí."
          accion={
            <Link href="/nova/tareas/nueva" className={claseBoton('primario')}>
              Registrar tarea
            </Link>
          }
        />
      ) : (
        <TablaTareas tareas={tareas} />
      )}
    </>
  );
}
