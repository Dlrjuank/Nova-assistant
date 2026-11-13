import Link from 'next/link';
import { FilaCategorias } from '@/components/nova/FilaCategorias';
import { GruposTareas } from '@/components/nova/GruposTareas';
import { ResaltarTarea } from '@/components/nova/ResaltarTarea';
import { claseBoton } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { exigirSesion, listarCategorias, listarTareas } from '@/lib/dataService';
import { hoyBogota } from '@/lib/reglas/fechas';
import { filtroDeVista, PESTANAS_TAREAS, TEXTO_VISTA, textoVacio, vistaDeParametros, type Vista } from '@/lib/reglas/vistasTareas';
import { hrefTareas } from '@/lib/rutasTareas';

export const dynamic = 'force-dynamic';

const uno = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string | string[]; estado?: string | string[]; categoria?: string | string[]; tarea?: string | string[] }>;
}) {
  const parametros = await searchParams;
  const pedidaResaltar = uno(parametros.tarea);
  const tareaResaltada = pedidaResaltar && /^[0-9a-f-]{36}$/i.test(pedidaResaltar) ? pedidaResaltar : null;
  // E08: pestaña en ?vista=; los enlaces viejos con ?estado= siguen funcionando (vistaDeParametros).
  const vista = vistaDeParametros(uno(parametros.vista), uno(parametros.estado));
  const hoy = hoyBogota();
  // El layout ya exige sesión con acceso; aquí hace falta el id para ver solo sus tareas (RB-01).
  const { id } = await exigirSesion();
  const categorias = await listarCategorias(id);
  // E05b: filtro por categoría (sin distinguir mayúsculas); se muestra con el nombre guardado.
  const pedida = uno(parametros.categoria)?.trim() ?? '';
  const categoria = pedida ? (categorias.find((c) => c.nombre.toLowerCase() === pedida.toLowerCase())?.nombre ?? pedida) : null;
  const tareas = await listarTareas(id, { ...filtroDeVista(vista, hoy), categoria: categoria ?? undefined });

  // "Vencidas" solo aparece como píldora mientras se está en esa vista (llega desde Inicio).
  const pestanas: Vista[] = vista === 'vencidas' ? [...PESTANAS_TAREAS, 'vencidas'] : [...PESTANAS_TAREAS];

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

      <FilaCategorias categorias={categorias} activa={categoria} vista={vista} />

      <Pestanas
        etiqueta="Vistas de tareas"
        pestanas={pestanas.map((v) => ({ href: hrefTareas(v, categoria), texto: TEXTO_VISTA[v], activa: v === vista }))}
      />

      {tareas.length === 0 ? (
        <EstadoVacio
          titulo={textoVacio(vista, categoria)}
          descripcion={vista === 'vencidas' ? 'Vas al día con tus fechas límite.' : 'Registra una tarea y aparecerá aquí.'}
          accion={
            <Link href="/nova/tareas/nueva" className={claseBoton('primario')}>
              Registrar tarea
            </Link>
          }
        />
      ) : (
        <GruposTareas tareas={tareas} categorias={categorias} hoy={hoy} />
      )}
      {/* E11c: la notificación de un recordatorio abre Tareas con esa tarea resaltada. */}
      {tareaResaltada && <ResaltarTarea id={tareaResaltada} />}
    </>
  );
}
