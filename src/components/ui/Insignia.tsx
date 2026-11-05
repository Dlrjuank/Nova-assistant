import type { ReactNode } from 'react';

export type TonoInsignia = 'neutro' | 'primario' | 'alta' | 'media' | 'baja' | 'completada';

// Fondo tintado y texto oscurecido: el color puro de la prioridad media no alcanza contraste AA sobre blanco.
const TONOS: Record<TonoInsignia, string> = {
  neutro: 'bg-usuario text-texto',
  primario: 'bg-primario-suave text-[color-mix(in_oklab,var(--color-primario)_80%,black)]',
  alta: 'bg-prioridad-alta/10 text-[color-mix(in_oklab,var(--color-prioridad-alta)_85%,black)]',
  media: 'bg-prioridad-media/15 text-[color-mix(in_oklab,var(--color-prioridad-media)_55%,black)]',
  baja: 'bg-prioridad-baja/10 text-[color-mix(in_oklab,var(--color-prioridad-baja)_85%,black)]',
  completada: 'bg-completada/10 text-[color-mix(in_oklab,var(--color-completada)_85%,black)]',
};

export function Insignia({ tono = 'neutro', children }: { tono?: TonoInsignia; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONOS[tono]}`}>
      {children}
    </span>
  );
}
