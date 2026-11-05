import type { ReactNode } from 'react';

export type TipoAviso = 'info' | 'exito' | 'advertencia' | 'error';

// El tipo también se dice con texto, no solo con color.
const TIPOS: Record<TipoAviso, { clase: string; rotulo: string; rol: 'status' | 'alert' }> = {
  info: { clase: 'border-primario/30 bg-primario-suave text-texto', rotulo: 'Información', rol: 'status' },
  exito: { clase: 'border-completada/40 bg-completada/10 text-texto', rotulo: 'Listo', rol: 'status' },
  advertencia: { clase: 'border-prioridad-media/40 bg-prioridad-media/10 text-texto', rotulo: 'Atención', rol: 'alert' },
  error: { clase: 'border-prioridad-alta/40 bg-prioridad-alta/10 text-texto', rotulo: 'Error', rol: 'alert' },
};

export function Aviso({ tipo = 'info', children }: { tipo?: TipoAviso; children: ReactNode }) {
  const { clase, rotulo, rol } = TIPOS[tipo];
  return (
    <div role={rol} className={`rounded-lg border px-4 py-3 text-sm ${clase}`}>
      <strong className="mr-1.5 font-semibold">{rotulo}:</strong>
      {children}
    </div>
  );
}
