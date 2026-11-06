import type { ReactNode } from 'react';

export type TonoInsignia = 'neutro' | 'acento' | 'peligro' | 'aviso' | 'exito';

// Texto del color del tono sobre su propio tinte al 12 %: la prueba de contraste cubre cada combinación.
// El significado siempre va también en el texto, nunca solo en el color.
const TONOS: Record<TonoInsignia, string> = {
  neutro: 'bg-superficie-2 text-texto',
  acento: 'bg-acento/12 text-acento',
  peligro: 'bg-peligro/12 text-peligro',
  aviso: 'bg-aviso/12 text-aviso',
  exito: 'bg-exito/12 text-exito',
};

export function Insignia({ tono = 'neutro', children }: { tono?: TonoInsignia; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONOS[tono]}`}>
      {children}
    </span>
  );
}
