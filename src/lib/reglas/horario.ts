import { ErrorDeNegocio } from './errores';
import type { FormatoHora } from './preferencias';

/**
 * RB-34 (E06b, pedido del usuario): horario opcional de una tarea. Las horas son 'HH:MM' de 24 horas
 * (el selector de hora del navegador las entrega así). Puede haber solo hora de inicio, nunca solo de fin,
 * y la de fin es posterior a la de inicio dentro del mismo día. No se valida que dos tareas se crucen.
 */
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface Horario {
  horaInicio: string | null;
  horaFin: string | null;
}

/** '8:5', ' 08:05 ' o '08:05:00' (como lo devuelve Postgres) → '08:05'; vacío → null. */
function normalizarHora(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? '';
  if (texto === '') return null;
  const m = /^(\d{1,2}):(\d{1,2})(?::\d{2})?$/.exec(texto);
  const hora = m ? `${m[1]!.padStart(2, '0')}:${m[2]!.padStart(2, '0')}` : texto;
  if (!HORA.test(hora)) throw new ErrorDeNegocio('HORA_INVALIDA');
  return hora;
}

export function validarHorario(inicio?: string | null, fin?: string | null): Horario {
  const horaInicio = normalizarHora(inicio);
  const horaFin = normalizarHora(fin);
  if (horaFin !== null && horaInicio === null) throw new ErrorDeNegocio('HORA_FIN_SIN_INICIO');
  if (horaFin !== null && horaInicio !== null && horaFin <= horaInicio) throw new ErrorDeNegocio('HORA_FIN_ANTES');
  return { horaInicio, horaFin };
}

/**
 * '08:00' → '8:00' (24 horas, sin cero a la izquierda en la hora, como en la imagen de referencia).
 * E11: con 12 horas, '08:00' → '8:00 a. m.', '13:30' → '1:30 p. m.', '00:15' → '12:15 a. m.'.
 */
export function formatearHora(hora: string, formato: FormatoHora = '24'): string {
  const [h, m] = hora.split(':');
  const n = Number(h);
  if (formato === '24') return `${n}:${m}`;
  return `${n % 12 || 12}:${m} ${n < 12 ? 'a. m.' : 'p. m.'}`;
}

/** "8:00 – 9:30", "8:00" (solo inicio) o '' (sin horario), en el formato de Configuración (E11). */
export function formatearHorario(h: Partial<Horario>, formato: FormatoHora = '24'): string {
  if (!h.horaInicio) return '';
  return h.horaFin ? `${formatearHora(h.horaInicio, formato)} – ${formatearHora(h.horaFin, formato)}` : formatearHora(h.horaInicio, formato);
}

/**
 * Orden de las tareas de un día (Mi semana, Calendario): primero las que tienen hora, por hora de inicio
 * (y de fin); después las que no, por prioridad (Alta primero) y título.
 */
export function compararPorHorario(
  a: Partial<Horario> & { prioridad: number; titulo: string },
  b: Partial<Horario> & { prioridad: number; titulo: string },
): number {
  if (a.horaInicio && b.horaInicio) {
    return a.horaInicio.localeCompare(b.horaInicio) || (a.horaFin ?? '').localeCompare(b.horaFin ?? '');
  }
  if (a.horaInicio) return -1;
  if (b.horaInicio) return 1;
  return b.prioridad - a.prioridad || a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' });
}
