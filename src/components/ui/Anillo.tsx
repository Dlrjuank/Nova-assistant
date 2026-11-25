import type { CSSProperties, ReactNode } from 'react';

const RADIO = 42;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

export type TonoAnillo = 'acento' | 'exito' | 'aviso' | 'peligro';

const TRAZO: Record<TonoAnillo, string> = { acento: 'stroke-acento', exito: 'stroke-exito', aviso: 'stroke-aviso', peligro: 'stroke-peligro' };
// Clases escritas completas: Tailwind solo genera las que encuentra tal cual en el código.
const RELLENO: Record<TonoAnillo, string> = { acento: 'fill-acento', exito: 'fill-exito', aviso: 'fill-aviso', peligro: 'fill-peligro' };

/**
 * E20b (commit 8): anillo que se llena al aparecer hasta `fraccion` (de 0 a 1), con lo que va en el centro
 * (por ejemplo un `Contador`). Es decorativo para lectores de pantalla: el centro debe decir el dato en texto.
 * Con "reducir movimiento", la regla global deja la animación quieta y el anillo aparece ya lleno.
 */
export function Anillo({ fraccion, tono = 'acento', tamano = 'size-28', children }: { fraccion: number; tono?: TonoAnillo; tamano?: string; children: ReactNode }) {
  const f = Math.min(1, Math.max(0, fraccion));
  return (
    <div className={`relative shrink-0 ${tamano}`} data-anillo data-fraccion={f.toFixed(3)}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={RADIO} fill="none" strokeWidth="10" className="stroke-superficie-2" />
        <circle
          cx="50"
          cy="50"
          r={RADIO}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - f)}
          style={{ '--nova-anillo-desde': CIRCUNFERENCIA } as CSSProperties}
          className={`nova-anillo transition-[stroke-dashoffset] duration-200 ${TRAZO[tono]}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>
    </div>
  );
}

/**
 * E20b (commit 8): minigráfico de línea con los valores en orden (del más antiguo al más reciente), escalados
 * entre `min` y `max`. Decorativo: los datos van también en texto al lado.
 */
export function MiniGrafico({ valores, min = 0, max, tono = 'acento', etiqueta }: { valores: readonly number[]; min?: number; max: number; tono?: TonoAnillo; etiqueta?: string }) {
  if (valores.length < 2) return null;
  const ancho = 80;
  const alto = 24;
  const x = (i: number) => (i / (valores.length - 1)) * (ancho - 4) + 2;
  const y = (v: number) => alto - 2 - ((Math.min(max, Math.max(min, v)) - min) / (max - min || 1)) * (alto - 4);
  const puntos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ultimo = valores[valores.length - 1] as number;
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-6 w-20 shrink-0" aria-hidden="true" data-minigrafico={etiqueta}>
      <polyline points={puntos} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`nova-trazo-linea ${TRAZO[tono]}`} pathLength={1} />
      <circle cx={x(valores.length - 1)} cy={y(ultimo)} r="2.5" className={RELLENO[tono]} />
    </svg>
  );
}
