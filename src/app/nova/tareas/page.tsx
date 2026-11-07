import Link from 'next/link';
import { FilaCategorias } from '@/components/nova/FilaCategorias';
import { TablaTareas } from '@/components/nova/TablaTareas';
import { claseBoton } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { exigirSesion, listarCategorias, listarTareas, type EstadoTarea } from '@/lib/dataService';
import { hrefTareas } from '@/lib/rutasTareas';

export const dynamic = 'force-dynamic';

const FILTROS: Array<{ valor: EstadoTarea | undefined; texto: string }> = [
  { valor: undefined, texto: 'Todas' },
  { valor: 'Pendiente', texto: 'Pendientes' },
  { valor: 'Completada', texto: 'Completadas' },
];

function estadoValido(valor: string | undefined): EstadoTarea | undefined {
  return valor === 'Pendiente' || valor === 'En Progreso' || valor === 'Completada' ? valor : undefined;
}

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; categoria?: string | string[] }>;
}) {
  const parametros = await searchParams;
  const estado = estadoValido(parametros.estado);
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus tareas (RB-01).
  const { id } = await exigirSesion();
  const categorias = await listarCategorias(id);
  // E05b: filtro por categoría (sin distinguir mayúsculas); se muestra con el nombre guardado.
  const pedida = typeof parametros.categoria === 'string' ? parametros.categoria.trim() : '';
  const categoria = pedida ? (categorias.find((c) => c.nombre.toLowerCase() === pedida.toLowerCase())?.nombre ?? pedida) : null;
  const tareas = await listarTareas(id, { estado, categoria: categoria ?? undefined });

  const vacio = (() => {
    const deEstado = estado ? ` ${estado === 'Pendiente' ? 'pendientes' : estado.toLowerCase() + 's'}` : '';
    if (categoria) return `No hay tareas${deEstado} en «${categoria}»`;
    return estado ? `No hay tareas${deEstado}` : 'Aún no tienes tareas';
  })();

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

      <FilaCategorias categorias={categorias} activa={categoria} estado={estado} />

      <Pestanas
        etiqueta="Filtrar por estado"
        pestanas={FILTROS.map(({ valor, texto }) => ({
          href: hrefTareas(valor, categoria),
          texto,
          activa: valor === estado,
        }))}
      />

      {tareas.length === 0 ? (
        <EstadoVacio
          titulo={vacio}
          descripcion="Registra una tarea y aparecerá aquí."
          accion={
            <Link href="/nova/tareas/nueva" className={claseBoton('primario')}>
              Registrar tarea
            </Link>
          }
        />
      ) : (
        <TablaTareas tareas={tareas} categorias={categorias} />
      )}
    </>
  );
}
