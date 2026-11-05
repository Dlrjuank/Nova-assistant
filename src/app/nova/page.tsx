import Link from 'next/link';
import { claseBoton } from '@/components/ui/Boton';
import { EstadoVacio } from '@/components/ui/EstadoVacio';

// Marcador de posición: el chat del asistente llega en P08.
export default function AsistentePage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Asistente</h1>
      <EstadoVacio
        titulo="El chat del asistente llega en un próximo paso"
        descripcion="Mientras tanto puedes registrar tus tareas."
        accion={
          <Link href="/nova/tareas" className={claseBoton('primario')}>
            Ver tareas
          </Link>
        }
      />
    </>
  );
}
