import { Sparkles } from 'lucide-react';
import { GuardarFuente } from '@/components/nova/GuardarFuente';
import { ListaFuentes } from '@/components/nova/ListaFuentes';
import { Boton } from '@/components/ui/Boton';
import type { Fuente } from '@/lib/dataService';
import { BOTON_PREGUNTAR_IA, MARCA_IA } from '@/lib/reglas/iaGeneral';
import { MODOS_EXPLICAR, type ModoExplicar } from '@/lib/reglas/preguntasLibro';

export type AutorMensaje = 'usuario' | 'asistente';

/** El autor se distingue por color, alineación y rótulo, nunca solo por color. */
export function MensajeChat({
  autor,
  texto,
  fuentes = [],
  alExplicar,
  ocupado = false,
  guardable = false,
  deIa = false,
  alPreguntarIa,
}: {
  autor: AutorMensaje;
  texto: string;
  fuentes?: Fuente[];
  /** RB-41: solo en las respuestas que citan documentos. */
  alExplicar?: ((modo: ModoExplicar, texto: string) => void) | undefined;
  ocupado?: boolean;
  /** RB-55: solo en las respuestas de Wikipedia con artículos. */
  guardable?: boolean;
  /** RB-59: respuesta de la IA general, siempre con su marca. */
  deIa?: boolean;
  /** RB-60: solo bajo un "No encontré" de documentos. */
  alPreguntarIa?: (() => void) | undefined;
}) {
  const esUsuario = autor === 'usuario';
  return (
    <li className={`flex flex-col gap-1 ${esUsuario ? 'items-end' : 'items-start'}`}>
      <span className="px-1 text-xs font-semibold text-texto-suave">{esUsuario ? 'Tú' : 'Nova'}</span>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm sm:max-w-[80%] ${esUsuario ? 'rounded-tr-sm bg-superficie-2' : 'rounded-tl-sm bg-acento-suave'}`}
      >
        {deIa && (
          <p className="mb-2 flex items-start gap-1.5 text-xs font-semibold text-texto-suave">
            <Sparkles aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {MARCA_IA}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words text-texto">{texto}</p>
        <ListaFuentes fuentes={fuentes} />
        {guardable && fuentes[0]?.url && <GuardarFuente url={fuentes[0].url} resumen={texto} />}
        {alPreguntarIa && (
          <div className="mt-3">
            <Boton variante="secundario" disabled={ocupado} onClick={alPreguntarIa} className="min-h-10 px-3 py-1 text-xs">
              {BOTON_PREGUNTAR_IA}
            </Boton>
          </div>
        )}
        {alExplicar && (
          <div role="group" aria-label="Explicar de otra manera" className="mt-3 flex flex-wrap gap-1.5">
            {MODOS_EXPLICAR.map((m) => (
              <Boton key={m.id} variante="secundario" disabled={ocupado} onClick={() => alExplicar(m.id, m.texto)} className="min-h-9 px-3 py-1 text-xs">
                {m.texto}
              </Boton>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
