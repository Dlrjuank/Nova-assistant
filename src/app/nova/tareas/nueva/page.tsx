import { FormularioTarea } from '@/components/nova/FormularioTarea';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { exigirSesion, listarCategorias } from '@/lib/dataService';
import { esFechaISOValida } from '@/lib/reglas/fechas';

export const dynamic = 'force-dynamic';

/** `?fecha=YYYY-MM-DD` válida (desde Inicio o el Calendario) queda puesta en el campo; una inválida se ignora. */
export default async function NuevaTareaPage({ searchParams }: { searchParams: Promise<{ fecha?: string | string[] }> }) {
  const { fecha } = await searchParams;
  const fechaInicial = typeof fecha === 'string' && esFechaISOValida(fecha) ? fecha : '';
  // E08: las categorías del usuario (RB-01) para la lista del campo de categoría.
  const { id } = await exigirSesion();
  const categorias = await listarCategorias(id);

  return (
    <>
      <EncabezadoPantalla titulo="Registrar tarea" subtitulo="Título, categoría, prioridad y fecha límite." />
      <Tarjeta className="max-w-xl">
        <FormularioTarea fechaInicial={fechaInicial} categorias={categorias.map(({ nombre, color }) => ({ nombre, color }))} />
      </Tarjeta>
    </>
  );
}
