import { Insignia } from '@/components/ui/Insignia';
import type { EstadoTarea } from '@/lib/dataService';

export function InsigniaEstadoTarea({ estado }: { estado: EstadoTarea }) {
  return <Insignia tono={estado === 'Completada' ? 'completada' : 'neutro'}>{estado}</Insignia>;
}
