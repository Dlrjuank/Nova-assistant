import type { HTMLAttributes } from 'react';

export function Tarjeta({ className = '', ...resto }: HTMLAttributes<HTMLDivElement>) {
  return <div {...resto} className={`rounded-2xl border border-borde bg-superficie p-4 shadow-suave sm:p-6 ${className}`} />;
}
