import { AccionesTarea } from '@/components/nova/AccionesTarea';
import { InsigniaEstadoTarea } from '@/components/nova/InsigniaEstadoTarea';
import { InsigniaPrioridad } from '@/components/nova/InsigniaPrioridad';
import type { Tarea } from '@/lib/dataService';
import { formatearFecha, formatearMinutos } from '@/lib/formato';

const COLUMNAS = ['Título', 'Categoría', 'Prioridad', 'Estado', 'Fecha límite', 'Creada', 'Acciones'];

/** Tabla desde 640 px; por debajo, tarjetas apiladas. */
export function TablaTareas({ tareas }: { tareas: Tarea[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-borde bg-superficie sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-superficie-2 text-texto">
            <tr>
              {COLUMNAS.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {tareas.map((t) => (
              <tr key={t.id} className="align-top">
                <th scope="row" className="px-4 py-3 font-medium text-texto">
                  {t.titulo}
                </th>
                <td className="px-4 py-3 text-texto-suave">{t.categoria}</td>
                <td className="px-4 py-3">
                  <InsigniaPrioridad prioridad={t.prioridad} />
                </td>
                <td className="px-4 py-3">
                  <InsigniaEstadoTarea estado={t.estado} />
                  {t.estado === 'Completada' && (
                    <p className="mt-1 whitespace-nowrap text-xs text-texto-suave">
                      {formatearMinutos(t.minutosInvertidos)}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-texto-suave">{formatearFecha(t.fechaLimite)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-texto-suave">{formatearFecha(t.fechaCreacion)}</td>
                <td className="px-4 py-3">
                  <AccionesTarea id={t.id} titulo={t.titulo} completada={t.estado === 'Completada'} prefijo="tabla" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 sm:hidden">
        {tareas.map((t) => (
          <li key={t.id} className="rounded-xl border border-borde bg-superficie p-4">
            <p className="font-semibold text-texto">{t.titulo}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <InsigniaPrioridad prioridad={t.prioridad} />
              <InsigniaEstadoTarea estado={t.estado} />
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-texto-suave">Categoría</dt>
              <dd>{t.categoria}</dd>
              <dt className="text-texto-suave">Fecha límite</dt>
              <dd>{formatearFecha(t.fechaLimite)}</dd>
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
