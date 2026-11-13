import Link from 'next/link';
import { EliminarDocumento } from '@/components/nova/EliminarDocumento';
import { claseBoton } from '@/components/ui/Boton';
import type { Documento } from '@/lib/dataService';
import { formatearFecha } from '@/lib/formato';
import { MENSAJE_REINDEXAR } from '@/lib/reglas/libros';

const COLUMNAS = ['Nombre', 'Categoría', 'Páginas', 'Fragmentos', 'Indexado', 'Acciones'];

/** E10b: mientras se indexa por partes se ve el avance (RB-38); un documento anterior avisa que le faltan páginas (RB-36). */
function Estado({ d }: { d: Documento }) {
  return <>{d.progreso === null || d.progreso === undefined ? d.numFragmentos : `Indexando… ${d.progreso} %`}</>;
}

function Nota({ d }: { d: Documento }) {
  if (d.paginas !== null || d.progreso !== null) return null;
  return <p className="mt-1 text-xs font-normal break-normal text-texto-suave">{MENSAJE_REINDEXAR}</p>;
}

function Acciones({ d }: { d: Documento }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:min-w-56">
      {d.paginas != null && d.progreso == null && (
        <Link href={`/nova/fuentes/${d.id}/capitulos`} prefetch={false} aria-label={`Ver capítulos de ${d.nombreArchivo}`} className={`${claseBoton('secundario')} min-h-9 py-1.5`}>
          Ver capítulos
        </Link>
      )}
      {d.paginas != null && d.progreso == null && (
        <Link href={`/nova/cuestionarios/nuevo?documento=${d.id}`} prefetch={false} aria-label={`Crear cuestionario de ${d.nombreArchivo}`} className={`${claseBoton('secundario')} min-h-9 py-1.5`}>
          Crear cuestionario
        </Link>
      )}
      <EliminarDocumento id={d.id} nombre={d.nombreArchivo} />
    </div>
  );
}

/** Tabla desde 640 px; por debajo, tarjetas apiladas. */
export function TablaDocumentos({ documentos }: { documentos: Documento[] }) {
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
            {documentos.map((d) => (
              <tr key={d.id}>
                <th scope="row" className="break-all px-4 py-3 font-medium text-texto">
                  {d.nombreArchivo}
                  <Nota d={d} />
                </th>
                <td className="px-4 py-3 text-texto-suave">{d.categoria}</td>
                <td className="px-4 py-3 text-texto-suave">{d.paginas ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-texto-suave">
                  <Estado d={d} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-texto-suave">{formatearFecha(d.fechaGuardado)}</td>
                <td className="px-4 py-3">
                  <Acciones d={d} />
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
            <Nota d={d} />
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-texto-suave">Categoría</dt>
              <dd>{d.categoria}</dd>
              <dt className="text-texto-suave">Páginas</dt>
              <dd>{d.paginas ?? '—'}</dd>
              <dt className="text-texto-suave">Fragmentos</dt>
              <dd>
                <Estado d={d} />
              </dd>
              <dt className="text-texto-suave">Indexado</dt>
              <dd>{formatearFecha(d.fechaGuardado)}</dd>
            </dl>
            <div className="mt-3">
              <Acciones d={d} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
