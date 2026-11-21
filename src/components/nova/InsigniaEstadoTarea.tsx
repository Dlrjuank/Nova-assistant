import { Insignia } from '@/components/ui/Insignia';
import type { EstadoTarea } from '@/lib/dataService';
import { formatearMinutos } from '@/lib/formato';

/** E20b (commit 3): una completada con tiempo registrado lo lleva en la misma insignia ("Completada · 30 min"). */
export function InsigniaEstadoTarea({ estado, minutos }: { estado: EstadoTarea; minutos?: number | undefined }) {
  const conTiempo = estado === 'Completada' && minutos !== undefined && minutos > 0;
  return <Insignia tono={estado === 'Completada' ? 'exito' : 'neutro'}>{conTiempo ? `${estado} · ${formatearMinutos(minutos)}` : estado}</Insignia>;
}
