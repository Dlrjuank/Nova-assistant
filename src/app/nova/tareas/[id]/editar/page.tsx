import Link from 'next/link';
import { FormularioTarea } from '@/components/nova/FormularioTarea';
import { claseBoton } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { exigirSesion, listarCategorias, obtenerTarea } from '@/lib/dataService';
import { MENSAJES } from '@/lib/reglas/errores';
import { rutaVolverSegura } from '@/lib/rutasTareas';
import { esquemaIdTarea } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E09 (PLAN_AMPLIACION 5.4, RB-29). `?volver=` es la pantalla de origen (solo rutas internas de Nova). */
export default async function EditarTareaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ volver?: string | string[] }>;
}) {
  const [{ id }, { volver }] = await Promise.all([params, searchParams]);
  const destino = rutaVolverSegura(volver);
  const sesion = await exigirSesion();
  const idValido = esquemaIdTarea.safeParse(id);
  // Una tarea de otro usuario se comporta como inexistente (RB-01).
  const tarea = idValido.success ? await obtenerTarea(sesion.id, idValido.data) : null;

  if (!tarea || tarea.estado === 'Completada') {
    return (
      <>
        <EncabezadoPantalla titulo="Editar tarea" />
        <EstadoVacio
          titulo={tarea ? MENSAJES.TAREA_YA_COMPLETADA : MENSAJES.TAREA_NO_ENCONTRADA}
          descripcion={tarea ? 'Las tareas completadas no se editan.' : 'Puede que ya la hayas eliminado.'}
          accion={
            <Link href={destino} className={claseBoton('primario')}>
              Volver
            </Link>
          }
        />
      </>
    );
  }

  const categorias = await listarCategorias(sesion.id);
  return (
    <>
      <EncabezadoPantalla titulo="Editar tarea" subtitulo="Corrige el título, la categoría, la prioridad, la fecha o el horario." />
      <Tarjeta className="max-w-xl">
        <FormularioTarea
          tarea={{
            id: tarea.id,
            titulo: tarea.titulo,
            categoria: tarea.categoria,
            prioridad: tarea.prioridad,
            fechaLimite: String(tarea.fechaLimite).slice(0, 10),
            horaInicio: tarea.horaInicio,
            horaFin: tarea.horaFin,
          }}
          volver={destino}
          categorias={categorias.map(({ nombre, color }) => ({ nombre, color }))}
        />
      </Tarjeta>
    </>
  );
}
