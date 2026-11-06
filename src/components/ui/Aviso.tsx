import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type TipoAviso = 'info' | 'exito' | 'advertencia' | 'error';

// El tipo también se dice con texto, no solo con color ni con el ícono.
const TIPOS: Record<TipoAviso, { clase: string; icono: LucideIcon; colorIcono: string; rotulo: string; rol: 'status' | 'alert' }> = {
  info: { clase: 'border-acento/30 bg-acento-suave', icono: Info, colorIcono: 'text-acento', rotulo: 'Información', rol: 'status' },
  exito: { clase: 'border-exito/40 bg-exito/12', icono: CircleCheck, colorIcono: 'text-exito', rotulo: 'Listo', rol: 'status' },
  advertencia: { clase: 'border-aviso/40 bg-aviso/12', icono: TriangleAlert, colorIcono: 'text-aviso', rotulo: 'Atención', rol: 'alert' },
  error: { clase: 'border-peligro/40 bg-peligro/12', icono: CircleX, colorIcono: 'text-peligro', rotulo: 'Error', rol: 'alert' },
};

export function Aviso({ tipo = 'info', children }: { tipo?: TipoAviso; children: ReactNode }) {
  const { clase, icono: Icono, colorIcono, rotulo, rol } = TIPOS[tipo];
  return (
    <div role={rol} className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm text-texto ${clase}`}>
      <Icono aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${colorIcono}`} />
      <div>
        <strong className="mr-1.5 font-semibold">{rotulo}:</strong>
        {children}
      </div>
    </div>
  );
}
