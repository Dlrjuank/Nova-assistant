import { FormularioTarea } from '@/components/nova/FormularioTarea';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { Tarjeta } from '@/components/ui/Tarjeta';

export default function NuevaTareaPage() {
  return (
    <>
      <EncabezadoPantalla titulo="Registrar tarea" subtitulo="Título, categoría, prioridad y fecha límite." />
      <Tarjeta className="max-w-xl">
        <FormularioTarea />
      </Tarjeta>
    </>
  );
}
