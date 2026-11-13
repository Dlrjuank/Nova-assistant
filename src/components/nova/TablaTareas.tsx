import { AccionesTarea } from '@/components/nova/AccionesTarea';
import { InsigniaCategoria } from '@/components/nova/InsigniaCategoria';
import { InsigniaEstadoTarea } from '@/components/nova/InsigniaEstadoTarea';
import { InsigniaPrioridad } from '@/components/nova/InsigniaPrioridad';
import { Insignia } from '@/components/ui/Insignia';
import type { Tarea } from '@/lib/dataService';
import { formatearFecha, formatearMinutos } from '@/lib/formato';
import { estaVencida } from '@/lib/reglas/calendario';
import { colorDeCategoria } from '@/lib/reglas/categorias';
import { HorarioTarea } from '@/components/nova/PreferenciasNova';
import { Bell } from 'lucide-react';

/** E11c: campanita junto a la fecha si la tarea tiene un recordatorio por enviar. */
function ConRecordatorio({ tarea }: { tarea: Tarea }) {
  if (tarea.estado === 'Completada' || tarea.recordatorioEstado !== 'pendiente') return null;
  return (
    <span title="Con recordatorio" className="ml-1 inline-flex align-[-2px] text-texto-suave">
      <Bell aria-hidden="true" className="size-3.5" />
      <span className="sr-only">, con recordatorio</span>
    </span>
  );
}

const COLUMNAS = ['Título', 'Categoría', 'Prioridad', 'Estado', 'Fecha límite', 'Creada', 'Acciones'];

/**
 * E08: en los grupos, desde 1280 px, anchos fijos para que las columnas de una categoría queden alineadas
 * con las de la siguiente (el título toma el resto). Por debajo, cada tabla se acomoda sola.
 */
const ANCHO_GRUPO: Record<string, string> = {
  Prioridad: 'xl:w-[6.5rem]',
  Estado: 'xl:w-[11.5rem]',
  'Fecha límite': 'xl:w-[7rem]',
  Creada: 'xl:w-[6.5rem]',
  Acciones: 'xl:w-[17rem]', // "Completar", el ícono de editar y "Eliminar" en la misma línea
};

/**
 * Tabla desde 640 px; por debajo, tarjetas apiladas. E08: con `hoy`, las pendientes con fecha pasada llevan
 * "Vencida"; dentro de un grupo de categoría (`sinCategoria`) no se repite la columna de categoría.
 */
export function TablaTareas({
  tareas,
  categorias = [],
  hoy,
  sinCategoria = false,
  etiqueta,
}: {
  tareas: Tarea[];
  /** E05: para el color de cada categoría; una sin registrar se muestra en gris. */
  categorias?: ReadonlyArray<{ nombre: string; color: string }>;
  /** E08: fecha de hoy (Bogotá) para marcar las vencidas. */
  hoy?: string | undefined;
  sinCategoria?: boolean;
  /** Nombre accesible de la tabla (por ejemplo, la categoría del grupo). */
  etiqueta?: string | undefined;
}) {
  const insignia = (t: Tarea) => <InsigniaCategoria nombre={t.categoria} color={colorDeCategoria(t.categoria, categorias)} />;
  const vencida = (t: Tarea) => (hoy && estaVencida({ estado: t.estado, fechaLimite: String(t.fechaLimite).slice(0, 10) }, hoy) ? <Insignia tono="peligro">Vencida</Insignia> : null);
  const columnas = sinCategoria ? COLUMNAS.filter((c) => c !== 'Categoría') : COLUMNAS;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-borde bg-superficie sm:block">
        <table className={`w-full text-left text-sm ${sinCategoria ? 'xl:table-fixed' : ''}`} aria-label={etiqueta}>
          <thead className="bg-superficie-2 text-texto">
            <tr>
              {columnas.map((c) => (
                <th key={c} scope="col" className={`px-4 py-3 font-semibold ${sinCategoria ? (ANCHO_GRUPO[c] ?? '') : ''}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {tareas.map((t) => (
              <tr key={t.id} data-tarea-id={t.id} className="align-top">
                <th scope="row" className="px-4 py-3 font-medium break-words text-texto">
                  {t.titulo}
                </th>
                {!sinCategoria && <td className="px-4 py-3">{insignia(t)}</td>}
                <td className="px-4 py-3">
                  <InsigniaPrioridad prioridad={t.prioridad} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <InsigniaEstadoTarea estado={t.estado} />
                    {vencida(t)}
                  </div>
                  {t.estado === 'Completada' && (
                    <p className="mt-1 whitespace-nowrap text-xs text-texto-suave">
                      {formatearMinutos(t.minutosInvertidos)}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-texto-suave">
                  {formatearFecha(t.fechaLimite)}
                  <ConRecordatorio tarea={t} />
                  {t.horaInicio && (
                    <span className="block text-xs">
                      <HorarioTarea horaInicio={t.horaInicio} horaFin={t.horaFin} />
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-texto-suave">{formatearFecha(t.fechaCreacion)}</td>
                <td className="px-4 py-3">
                  <AccionesTarea id={t.id} titulo={t.titulo} completada={t.estado === 'Completada'} prefijo="tabla" editarSoloIcono />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 sm:hidden">
        {tareas.map((t) => (
          <li key={t.id} data-tarea-id={t.id} className="rounded-xl border border-borde bg-superficie p-4">
            <p className="font-semibold text-texto">{t.titulo}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <InsigniaPrioridad prioridad={t.prioridad} />
              <InsigniaEstadoTarea estado={t.estado} />
              {vencida(t)}
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {!sinCategoria && (
                <>
                  <dt className="text-texto-suave">Categoría</dt>
                  <dd>{insignia(t)}</dd>
                </>
              )}
              <dt className="text-texto-suave">Fecha límite</dt>
              <dd>
                {formatearFecha(t.fechaLimite)}
                <ConRecordatorio tarea={t} />
                {t.horaInicio && (
                  <>
                    {' · '}
                    <HorarioTarea horaInicio={t.horaInicio} horaFin={t.horaFin} />
                  </>
                )}
              </dd>
              <dt className="text-texto-suave">Creada</dt>
              <dd>{formatearFecha(t.fechaCreacion)}</dd>
              {t.estado === 'Completada' && (
                <>
                  <dt className="text-texto-suave">Dedicado</dt>
                  <dd>{formatearMinutos(t.minutosInvertidos)}</dd>
                </>
              )}
            </dl>
            <div className="mt-3">
              <AccionesTarea id={t.id} titulo={t.titulo} completada={t.estado === 'Completada'} prefijo="tarjeta" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
