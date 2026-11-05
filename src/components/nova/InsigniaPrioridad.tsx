import { Insignia, type TonoInsignia } from '@/components/ui/Insignia';
import { formatearPrioridad } from '@/lib/formato';

const TONO: Record<number, TonoInsignia> = { 1: 'baja', 2: 'media', 3: 'alta' };

export function InsigniaPrioridad({ prioridad }: { prioridad: number }) {
  return <Insignia tono={TONO[prioridad] ?? 'neutro'}>{formatearPrioridad(prioridad)}</Insignia>;
}
