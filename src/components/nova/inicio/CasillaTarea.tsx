'use client';

import { useRef, useState } from 'react';
import { Dialogo } from '@/components/ui/Dialogo';
import { FormularioMinutos } from '@/components/nova/FormularioMinutos';
import { InsigniaCategoria } from '@/components/nova/InsigniaCategoria';
import { InsigniaPrioridad } from '@/components/nova/InsigniaPrioridad';

export interface TareaCasilla {
  id: string;
  titulo: string;
  categoria: string;
  prioridad: number;
  estado: string;
}

/**
 * E06 (PLAN_AMPLIACION 5.1): tarea con casilla. Marcar una pendiente abre el mismo formulario de minutos que
 * en Tareas (FormularioMinutos) en un diálogo; cancelar no cambia nada. Una completada no se desmarca.
 */
export function CasillaTarea({
  tarea,
  color,
  prefijo,
  compacta = false,
}: {
  tarea: TareaCasilla;
  color: string;
  prefijo: string;
  /** En las columnas de la semana (computador): menos relleno. Muestra lo mismo que en el teléfono. */
  compacta?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const casilla = useRef<HTMLInputElement>(null);
  const completada = tarea.estado === 'Completada';
  const id = `${prefijo}-casilla-${tarea.id}`;

  const entrada = (
    <input
      ref={casilla}
      id={id}
      type="checkbox"
      checked={completada}
      disabled={completada}
      // Controlada: marcarla no la completa sola; abre el diálogo de minutos.
      onChange={() => setAbierto(true)}
      aria-label={completada ? `${tarea.titulo}: completada` : `Completar «${tarea.titulo}»`}
      className="mt-0.5 size-5 shrink-0 cursor-pointer accent-acento disabled:cursor-default"
    />
  );
  const titulo = (
    <label
      htmlFor={id}
      className={`min-w-0 text-sm font-medium break-words ${completada ? 'text-texto-suave line-through' : 'text-texto'}`}
    >
      {tarea.titulo}
    </label>
  );
  const insignias = (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      <InsigniaCategoria nombre={tarea.categoria} color={color} />
      <InsigniaPrioridad prioridad={tarea.prioridad} />
    </div>
  );

  return (
    <div
      className={`rounded-xl hover:bg-superficie-2 ${compacta ? 'flex flex-col gap-1.5 p-1.5' : 'flex items-start gap-2.5 p-2.5'}`}
    >
      {compacta ? (
        // Columnas de la semana: las insignias en su propia línea, con todo el ancho de la columna.
        <>
          <div className="flex items-start gap-2">
            {entrada}
            {titulo}
          </div>
          {insignias}
        </>
      ) : (
        <>
          {entrada}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {titulo}
            {insignias}
          </div>
        </>
      )}
      <Dialogo
        abierto={abierto}
        titulo={`Completar «${tarea.titulo}»`}
        descripcion="¿Cuántos minutos le dedicaste? Cuentan para tu índice de productividad."
        alCerrar={() => setAbierto(false)}
        origen={casilla}
      >
        <FormularioMinutos
          id={tarea.id}
          prefijo={`${prefijo}-dialogo`}
          alTerminar={() => setAbierto(false)}
          alCancelar={() => setAbierto(false)}
        />
      </Dialogo>
    </div>
  );
}
