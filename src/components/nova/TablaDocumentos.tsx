import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { EliminarDocumento } from '@/components/nova/EliminarDocumento';
import { claseBoton } from '@/components/ui/Boton';
import type { Documento } from '@/lib/dataService';
import { formatearFecha } from '@/lib/formato';
import { MENSAJE_REINDEXAR } from '@/lib/reglas/libros';
import { contarUnidades } from '@/lib/reglas/tiposDocumento';
import { SelloDocumento } from './SelloDocumento';

const COLUMNAS = ['Nombre', 'Categoría', 'Contenido', 'Fragmentos', 'Indexado', 'Acciones'];

/** E10b: mientras se indexa por partes se ve el avance (RB-38); un documento anterior avisa que le faltan páginas (RB-36). */
function Estado({ d }: { d: Documento }) {
  // E20d-3: la lectura con OCR, antes de los fragmentos.
  if (d.ocr?.estado === 'pregunta') return <>Espera tu respuesta</>;
  if (d.ocr?.estado === 'leyendo') return <>{`Leyendo con OCR… ${d.ocr.leidas} de ${d.ocr.total}`}</>;
  return <>{d.progreso === null || d.progreso === undefined ? d.numFragmentos : `Indexando… ${d.progreso} %`}</>;
}

/** E20d: "12 páginas", "5 secciones", "8 diapositivas"; los documentos anteriores a E10b no saben sus páginas. */
function Contenido({ d }: { d: Documento }) {
  return <>{d.paginas == null ? '—' : contarUnidades(d.paginas, d.unidad ?? 'pagina')}</>;
}

function Nota({ d }: { d: Documento }) {
  if (d.paginas !== null || d.progreso !== null) return null;
  return <p className="mt-1 text-xs font-normal break-normal text-texto-suave">{MENSAJE_REINDEXAR}</p>;
}

function Acciones({ d }: { d: Documento }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:min-w-56">
      {d.paginas != null && d.progreso == null && (
        <Link href={`/nova/fuentes/${d.id}/capitulos`} prefetch={false} aria-label={`Ver contenido de ${d.nombreArchivo}`} className={`${claseBoton('secundario')} min-h-9 py-1.5`}>
          Ver contenido
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
/** E13 (B-21): un documento de una materia muestra la materia, con su ícono; los demás, su categoría. */
function Categoria({ d }: { d: Documento }) {
  if (!d.materia) return <>{d.categoria}</>;
  return (
    <span className="inline-flex items-center gap-1.5 text-texto">
      <GraduationCap aria-hidden="true" className="size-4 shrink-0 text-acento" />
      <span className="sr-only">Materia: </span>
      {d.materia}
    </span>
  );
}

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
                <th scope="row" className="min-w-56 px-4 py-3 font-medium text-texto">
                  <div className="flex items-start gap-3">
                    <SelloDocumento tipo={d.tipo ?? 'pdf'} />
                    <div className="min-w-0 break-all">
                      {d.nombreArchivo}
                      <Nota d={d} />
                    </div>
                  </div>
                </th>
                <td className="px-4 py-3 text-texto-suave">
                  <Categoria d={d} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-texto-suave">
                  <Contenido d={d} />
                </td>
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
            <div className="flex items-start gap-3">
              <SelloDocumento tipo={d.tipo ?? 'pdf'} />
              <div className="min-w-0">
                <p className="break-all font-semibold text-texto">{d.nombreArchivo}</p>
                <Nota d={d} />
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-texto-suave">{d.materia ? 'Materia' : 'Categoría'}</dt>
              <dd>
                <Categoria d={d} />
              </dd>
              <dt className="text-texto-suave">Contenido</dt>
              <dd>
                <Contenido d={d} />
              </dd>
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
