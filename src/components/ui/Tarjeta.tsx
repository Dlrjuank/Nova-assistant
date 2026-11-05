import type { HTMLAttributes } from 'react';

export function Tarjeta({ className = '', ...resto }: HTMLAttributes<HTMLDivElement>) {
  return <div {...resto} className={`rounded-xl border border-borde bg-superficie p-4 shadow-sm sm:p-6 ${className}`} />;
}
