'use client';

import { useRef, useState } from 'react';
import { Dialogo } from '@/components/ui/Dialogo';
import { EnlaceEditarTarea } from '@/components/nova/EnlaceEditarTarea';
import { FormularioMinutos } from '@/components/nova/FormularioMinutos';
import { InsigniaCategoria } from '@/components/nova/InsigniaCategoria';
import { InsigniaPrioridad } from '@/components/nova/InsigniaPrioridad';
import { Insignia } from '@/components/ui/Insignia';
import { formatearHorario } from '@/lib/reglas/horario';

export interface TareaCasilla {
  id: string;
  titulo: string;
  categoria: string;
  prioridad: number;
  estado: string;
  /** RB-34: 'HH:MM' de 24 horas, opcionales. */
  horaInicio?: string | null;
  horaFin?: string | null;
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
  vencida = false,
  volver,
}: {
  tarea: TareaCasilla;
  color: string;
  prefijo: string;
  /** En las columnas de la semana (computador): menos relleno. Muestra lo mismo que en el teléfono. */
  compacta?: boolean;
  /** E07: pendiente con fecha límite pasada; se marca con una insignia sutil "Vencida". */
  vencida?: boolean;
  /** E09: pantalla a la que vuelve Editar, cuando la dirección actual no basta (día elegido del Calendario). */
  volver?: string | undefined;
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
  const horario = formatearHorario(tarea);
  const titulo = (
    <label
      htmlFor={id}
      className={`flex min-w-0 flex-col text-sm font-medium break-words ${completada ? 'text-texto-suave line-through' : 'text-texto'}`}
    >
      {tarea.titulo}
      {/* RB-34: el horario va dentro de la etiqueta, así también lo leen los lectores de pantalla. */}
      {horario && <span className="text-xs font-normal text-texto-suave">{horario}</span>}
    </label>
  );
  const estado = (
    <>
      <InsigniaPrioridad prioridad={tarea.prioridad} />
      {vencida && <Insignia tono="peligro">Vencida</Insignia>}
    </>
  );

  // E09: solo las pendientes se editan (RB-29).
  const editar = !completada && (
    <EnlaceEditarTarea id={tarea.id} titulo={tarea.titulo} volver={volver} soloIcono className={compacta ? 'size-7' : 'size-10'} />
  );

  return (
    <div
      className={`rounded-xl hover:bg-superficie-2 ${compacta ? 'flex flex-col gap-1.5 px-0.5 py-1.5' : 'flex items-start gap-2.5 p-2.5'}`}
    >
      {compacta ? (
        // Columnas de la semana: las insignias en su propia línea, con todo el ancho de la columna.
        <>
          <div className="flex items-start gap-2">
            {entrada}
            {titulo}
          </div>
          {/* La categoría tiene su línea, con todo el ancho; el lápiz va siempre al final de la línea de la prioridad. */}
          <InsigniaCategoria nombre={tarea.categoria} color={color} compacta />
          <div className="flex min-w-0 items-start justify-between gap-1">
            <div className="flex min-w-0 flex-wrap gap-1">{estado}</div>
            {editar}
          </div>
        </>
      ) : (
        <>
          {entrada}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {titulo}
            <div className="flex min-w-0 flex-wrap gap-1.5">
              <InsigniaCategoria nombre={tarea.categoria} color={color} />
              {estado}
            </div>
          </div>
          {editar}
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
