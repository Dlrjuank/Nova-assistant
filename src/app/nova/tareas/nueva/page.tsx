import { FormularioTarea } from '@/components/nova/FormularioTarea';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { esFechaISOValida } from '@/lib/reglas/fechas';

/** `?fecha=YYYY-MM-DD` válida (desde Inicio o el Calendario) queda puesta en el campo; una inválida se ignora. */
export default async function NuevaTareaPage({ searchParams }: { searchParams: Promise<{ fecha?: string | string[] }> }) {
  const { fecha } = await searchParams;
  const fechaInicial = typeof fecha === 'string' && esFechaISOValida(fecha) ? fecha : '';

  return (
    <>
      <EncabezadoPantalla titulo="Registrar tarea" subtitulo="Título, categoría, prioridad y fecha límite." />
      <Tarjeta className="max-w-xl">
        <FormularioTarea fechaInicial={fechaInicial} />
      </Tarjeta>
    </>
  );
}
