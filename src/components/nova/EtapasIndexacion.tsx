import { AlertCircle } from 'lucide-react';
import { ETAPAS_INDEXACION, estadoEtapa, textoEtapa, type EtapaIndexacion } from '@/lib/reglas/etapasIndexacion';

/**
 * E20b (commit 6): las cinco etapas de indexar un PDF se encienden en orden. La hecha lleva un check que se dibuja,
 * la de ahora late y dice "ahora" (o su porcentaje), la que falló lleva un ícono de alerta. Para lectores de
 * pantalla, una sola línea de estado con la etapa en curso; la lista visible no se anuncia entera en cada cambio.
 */
export function EtapasIndexacion({
  actual,
  terminado = false,
  fallo = false,
  avance,
}: {
  actual: EtapaIndexacion | null;
  terminado?: boolean;
  fallo?: boolean;
  /** Porcentaje de la etapa en curso (al subir, o al crear los vectores de un libro largo). */
  avance?: number | undefined;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="sr-only">
        {terminado ? 'Todas las etapas terminaron.' : actual ? `${textoEtapa(actual)}${fallo ? ', no se pudo terminar' : ''}${avance !== undefined ? `, ${avance} %` : ''}` : ''}
      </p>
      <ol aria-label="Etapas de la indexación" className="flex flex-col gap-1.5" data-etapas>
        {ETAPAS_INDEXACION.map((e) => {
          const estado = estadoEtapa(e.id, actual, { terminado, fallo });
          return (
            <li
              key={e.id}
              data-etapa={e.id}
              data-estado={estado}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-200 ${
                estado === 'ahora' ? 'bg-acento-suave text-texto' : estado === 'fallo' ? 'bg-peligro/10 text-texto' : estado === 'hecha' ? 'text-texto' : 'text-texto-suave'
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                  estado === 'hecha'
                    ? 'border-exito bg-exito text-superficie'
                    : estado === 'ahora'
                      ? 'nova-etapa-ahora border-acento'
                      : estado === 'fallo'
                        ? 'border-peligro text-peligro'
                        : 'border-borde'
                }`}
              >
                {estado === 'hecha' && (
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" className="nova-trazo-check" />
                  </svg>
                )}
                {estado === 'fallo' && <AlertCircle className="size-3.5" />}
                {estado === 'ahora' && <span className="size-2 rounded-full bg-acento" />}
              </span>
              <span className="min-w-0 flex-1">{e.texto}</span>
              {estado === 'ahora' && <span className="font-mono text-[0.7rem] text-texto-suave">{avance !== undefined ? `${avance} %` : 'ahora'}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
