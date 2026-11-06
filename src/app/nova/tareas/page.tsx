import Link from 'next/link';
import { TablaTareas } from '@/components/nova/TablaTareas';
import { claseBoton } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
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
      <EncabezadoPantalla
        titulo="Tareas"
        subtitulo="Registra, completa y elimina tus tareas."
        accion={
          <Link href="/nova/tareas/nueva" className={claseBoton('primario')}>
            Registrar tarea
          </Link>
        }
      />

      <Pestanas
        etiqueta="Filtrar por estado"
        pestanas={FILTROS.map(({ valor, texto }) => ({
          href: valor ? `/nova/tareas?estado=${encodeURIComponent(valor)}` : '/nova/tareas',
          texto,
          activa: valor === estado,
        }))}
      />

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
