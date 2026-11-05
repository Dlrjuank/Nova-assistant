import { ListaFuentes } from '@/components/nova/ListaFuentes';
import type { Fuente } from '@/lib/dataService';

export type AutorMensaje = 'usuario' | 'asistente';

/** El autor se distingue por color, alineación y rótulo, nunca solo por color. */
export function MensajeChat({
  autor,
  texto,
  fuentes = [],
}: {
  autor: AutorMensaje;
  texto: string;
  fuentes?: Fuente[];
}) {
  const esUsuario = autor === 'usuario';
  return (
    <li className={`flex flex-col gap-1 ${esUsuario ? 'items-end' : 'items-start'}`}>
      <span className="px-1 text-xs font-semibold text-texto-suave">{esUsuario ? 'Tú' : 'Nova'}</span>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm sm:max-w-[80%] ${esUsuario ? 'rounded-tr-sm bg-usuario' : 'rounded-tl-sm bg-primario-suave'}`}
      >
        <p className="whitespace-pre-wrap break-words text-texto">{texto}</p>
        <ListaFuentes fuentes={fuentes} />
      </div>
    </li>
  );
}
