import { EliminarDocumento } from '@/components/nova/EliminarDocumento';
import type { Documento } from '@/lib/dataService';
import { formatearFecha } from '@/lib/formato';

const COLUMNAS = ['Nombre', 'Categoría', 'Fragmentos', 'Indexado', 'Acciones'];

/** Tabla desde 640 px; por debajo, tarjetas apiladas. */
export function TablaDocumentos({ documentos }: { documentos: Documento[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-borde bg-superficie sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-primario-suave text-texto">
            <tr>
              {COLUMNAS.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {documentos.map((d) => (
              <tr key={d.id}>
                <th scope="row" className="break-all px-4 py-3 font-medium text-texto">
                  {d.nombreArchivo}
                </th>
                <td className="px-4 py-3 text-texto-suave">{d.categoria}</td>
                <td className="px-4 py-3 text-texto-suave">{d.numFragmentos}</td>
                <td className="whitespace-nowrap px-4 py-3 text-texto-suave">{formatearFecha(d.fechaGuardado)}</td>
                <td className="px-4 py-3">
                  <EliminarDocumento id={d.id} nombre={d.nombreArchivo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 sm:hidden">
        {documentos.map((d) => (
          <li key={d.id} className="rounded-xl border border-borde bg-superficie p-4">
            <p className="break-all font-semibold text-texto">{d.nombreArchivo}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-texto-suave">Categoría</dt>
              <dd>{d.categoria}</dd>
              <dt className="text-texto-suave">Fragmentos</dt>
              <dd>{d.numFragmentos}</dd>
              <dt className="text-texto-suave">Indexado</dt>
              <dd>{formatearFecha(d.fechaGuardado)}</dd>
            </dl>
            <div className="mt-3">
              <EliminarDocumento id={d.id} nombre={d.nombreArchivo} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
