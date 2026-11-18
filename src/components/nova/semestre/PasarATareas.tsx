'use client';

import { CheckCircle2, ListPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { formatearFecha, formatearPrioridad } from '@/lib/formato';
import { ConDialogo } from './ConDialogo';
import { pedirSemestre } from './peticion';

/** E19 (9.5): el enlace "En Tareas" de un paso ya pasado; abre Tareas con la tarea resaltada. */
export function EnTareas({ tareaId }: { tareaId: string }) {
  return (
    <Link
      href={`/nova/tareas?tarea=${tareaId}`}
      prefetch={false}
      className={`inline-flex min-h-9 items-center gap-1 self-start rounded text-xs font-semibold text-exito underline-offset-2 hover:underline ${CLASE_FOCO}`}
    >
      <CheckCircle2 aria-hidden="true" className="size-4" />
      En Tareas
    </Link>
  );
}

function Confirmar({ planId, pasoId, titulo, fecha, materia, cerrar }: { planId: string; pasoId: string; titulo: string; fecha: string; materia: string; cerrar: () => void }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function pasar() {
    setError('');
    setEnviando(true);
    const r = await pedirSemestre(`/api/nova/planes/${planId}/pasos/${pasoId}/tarea`, 'POST');
    setEnviando(false);
    if (!r.ok) {
      setError(r.mensaje);
      router.refresh(); // si ya estaba en Tareas (RB-24), la marca aparece al cerrar
      return;
    }
    cerrar();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-texto-suave">Título</dt>
        <dd className="font-medium break-words text-texto">{titulo}</dd>
        <dt className="text-texto-suave">Fecha límite</dt>
        <dd className="text-texto">{formatearFecha(fecha)}</dd>
        <dt className="text-texto-suave">Categoría</dt>
        <dd className="break-words text-texto">{materia}</dd>
        <dt className="text-texto-suave">Prioridad</dt>
        <dd className="text-texto">{formatearPrioridad(2)}</dd>
      </dl>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" disabled={enviando} onClick={cerrar}>
          Cancelar
        </Boton>
        <Boton cargando={enviando} disabled={enviando} onClick={() => void pasar()}>
          Pasar a Tareas
        </Boton>
      </div>
    </div>
  );
}

/** E19 (9.5, RB-24): "Pasar a Tareas" de un paso, con el diálogo que muestra la tarea y pide confirmar. */
export function PasarATareas(props: { planId: string; pasoId: string; titulo: string; fecha: string; materia: string }) {
  return (
    <ConDialogo
      boton={
        <>
          <ListPlus aria-hidden="true" className="size-4" />
          Pasar a Tareas
        </>
      }
      variante="fantasma"
      className="min-h-9 self-start px-2 py-1 text-xs"
      etiqueta={`Pasar a Tareas: ${props.titulo}`}
      titulo="¿Pasar este paso a Tareas?"
      descripcion="Se crea una tarea pendiente con estos datos. Luego la puedes editar en Tareas."
    >
      {(cerrar) => <Confirmar {...props} cerrar={cerrar} />}
    </ConDialogo>
  );
}
