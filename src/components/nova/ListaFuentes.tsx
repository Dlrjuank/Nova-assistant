'use client';

import { ChevronDown, FileText } from 'lucide-react';
import { useId, useState } from 'react';
import { CLASE_FOCO } from '@/components/ui/Boton';
import type { Fuente } from '@/lib/dataService';
import { MARCA_TAREA } from '@/lib/reglas/asistente';
import { esUrlDeWikipedia } from '@/lib/reglas/fuentesWeb';

/**
 * Las fuentes de una respuesta, como chips. E20b (commit 5, presentación): una cita de PDF que trae su extracto se
 * despliega al tocarla y muestra el fragmento en cursiva con un borde de acento. Las respuestas guardadas antes
 * de E20b no traen extracto: su chip no se despliega.
 */
export function ListaFuentes({ fuentes: todas }: { fuentes: Fuente[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const base = useId();
  // E20b: las respuestas guardadas antes nombraban la tarea con su etiqueta interna ("Tarea 1a2b3c4d"): no se muestra.
  const fuentes = todas.filter((f) => !(f.tipo === 'tarea' && MARCA_TAREA.test(f.etiqueta)));
  if (fuentes.length === 0) return null;
  const elegida = fuentes.find((f) => f.etiqueta === abierta && f.fragmento);
  const idExtracto = `${base}-extracto`;
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-texto-suave">Fuentes</p>
      <ul className="flex flex-wrap gap-1.5">
        {fuentes.map((f) => {
          const chip = 'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs';
          if (f.url && esUrlDeWikipedia(f.url)) {
            return (
              <li key={f.etiqueta} className={`${chip} border-borde bg-superficie break-all text-texto-suave`}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-acento underline">
                  {f.etiqueta}
                </a>
              </li>
            );
          }
          if (f.tipo === 'pdf' && f.fragmento) {
            const activa = abierta === f.etiqueta;
            return (
              <li key={f.etiqueta} className="max-w-full">
                <button
                  type="button"
                  data-sin-conexion="permitido" // solo muestra lo que ya llegó
                  aria-expanded={activa}
                  aria-controls={activa ? idExtracto : undefined}
                  onClick={() => setAbierta(activa ? null : f.etiqueta)}
                  className={`${chip} text-left break-words transition-colors duration-150 ${CLASE_FOCO} ${
                    activa ? 'border-acento bg-acento-suave text-acento' : 'border-borde bg-superficie text-texto-suave hover:border-acento hover:text-acento'
                  }`}
                >
                  <FileText aria-hidden="true" className="size-3 shrink-0" />
                  <span>{f.etiqueta}</span>
                  <ChevronDown aria-hidden="true" className={`size-3 shrink-0 transition-transform duration-150 ${activa ? 'rotate-180' : ''}`} />
                </button>
              </li>
            );
          }
          return (
            <li key={f.etiqueta} className={`${chip} border-borde bg-superficie break-all text-texto-suave`}>
              {f.etiqueta}
            </li>
          );
        })}
      </ul>
      {elegida && (
        <blockquote id={idExtracto} className="nova-aparecer mt-1 border-l-2 border-acento py-1 pl-3 text-sm text-texto-suave italic">
          <span className="sr-only">Fragmento de {elegida.etiqueta}: </span>«{elegida.fragmento}»
        </blockquote>
      )}
    </div>
  );
}
