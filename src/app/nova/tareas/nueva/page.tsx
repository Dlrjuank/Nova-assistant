import { FormularioTarea } from '@/components/nova/FormularioTarea';
import { Tarjeta } from '@/components/ui/Tarjeta';

export default function NuevaTareaPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Registrar tarea</h1>
      <Tarjeta className="max-w-xl">
        <FormularioTarea />
      </Tarjeta>
    </>
  );
}
