import { Insignia, type TonoInsignia } from '@/components/ui/Insignia';
import { formatearPrioridad } from '@/lib/formato';

const TONO: Record<number, TonoInsignia> = { 1: 'neutro', 2: 'aviso', 3: 'peligro' };

export function InsigniaPrioridad({ prioridad }: { prioridad: number }) {
  return <Insignia tono={TONO[prioridad] ?? 'neutro'}>{formatearPrioridad(prioridad)}</Insignia>;
}
