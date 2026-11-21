import type { HTMLAttributes } from 'react';

/** E20b: radio de 20 px, sombra suave y más aire en el computador. */
export function Tarjeta({ className = '', ...resto }: HTMLAttributes<HTMLDivElement>) {
  return <div {...resto} className={`rounded-[20px] border border-borde bg-superficie p-4 shadow-suave sm:p-6 ${className}`} />;
}
