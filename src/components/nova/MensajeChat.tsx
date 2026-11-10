import { GuardarFuente } from '@/components/nova/GuardarFuente';
import { ListaFuentes } from '@/components/nova/ListaFuentes';
import { Boton } from '@/components/ui/Boton';
import type { Fuente } from '@/lib/dataService';
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
}: {
  autor: AutorMensaje;
  texto: string;
  fuentes?: Fuente[];
  /** RB-41: solo en las respuestas que citan documentos. */
  alExplicar?: ((modo: ModoExplicar, texto: string) => void) | undefined;
  ocupado?: boolean;
  /** RB-55: solo en las respuestas de Wikipedia con artículos. */
  guardable?: boolean;
}) {
  const esUsuario = autor === 'usuario';
  return (
    <li className={`flex flex-col gap-1 ${esUsuario ? 'items-end' : 'items-start'}`}>
      <span className="px-1 text-xs font-semibold text-texto-suave">{esUsuario ? 'Tú' : 'Nova'}</span>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm sm:max-w-[80%] ${esUsuario ? 'rounded-tr-sm bg-superficie-2' : 'rounded-tl-sm bg-acento-suave'}`}
      >
        <p className="whitespace-pre-wrap break-words text-texto">{texto}</p>
        <ListaFuentes fuentes={fuentes} />
        {guardable && fuentes[0]?.url && <GuardarFuente url={fuentes[0].url} resumen={texto} />}
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
