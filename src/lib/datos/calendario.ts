import { DIAS_PROXIMOS, esMesValido, mesDe, proximosDelCalendario, semanasDelMes, type Proximo } from '@/lib/reglas/calendario';
import { hoyBogota, sumarDias } from '@/lib/reglas/fechas';
import { tareasPorDia } from '@/lib/reglas/semana';
import { eventosSemestre, type EventoSemestre } from './semestre';
import { listarTareas } from './tareas';
import type { Tarea } from './tipos';

export interface Mes {
  mes: string;
  hoy: string;
  semanas: string[][];
  /** Tareas por día de toda la cuadrícula (también los días de los meses vecinos que se ven). */
  porDia: Record<string, Tarea[]>;
  /** E13: fechas de Semestre (cortes, fecha final y notas con fecha) por día. */
  eventos: Record<string, EventoSemestre[]>;
  /** E20b (commit 4): lo que viene desde hoy (tareas pendientes y fechas de Semestre), sin importar el mes que se ve. */
  proximos: Proximo[];
}

/**
 * E07 (PLAN_AMPLIACION 5.3): las tareas del usuario en la cuadrícula del mes (RB-01). En cada día, las
 * pendientes primero y las completadas al final; dentro, por horario y luego por prioridad (RB-34).
 * Sin mes o con uno inválido, el mes actual en Bogotá.
 */
export async function mesDeTareas(usuarioId: string, mes?: string): Promise<Mes> {
  const hoy = hoyBogota();
  const elegido = mes && esMesValido(mes) ? mes : mesDe(hoy);
  const semanas = semanasDelMes(elegido);
  const dias = semanas.flat();
  const [desde, hasta] = [dias[0] as string, dias[dias.length - 1] as string];
  const finProximos = sumarDias(hoy, DIAS_PROXIMOS);
  const [tareas, eventos, tareasProximas, eventosProximos] = await Promise.all([
    listarTareas(usuarioId, { desde, hasta }),
    eventosSemestre(usuarioId, desde, hasta),
    listarTareas(usuarioId, { desde: hoy, hasta: finProximos, estado: 'Pendiente' }),
    eventosSemestre(usuarioId, hoy, finProximos),
  ]);
  const proximos = proximosDelCalendario(
    tareasProximas.map((t) => ({ ...t, fechaLimite: String(t.fechaLimite).slice(0, 10) })),
    Object.values(eventosProximos).flat(),
    hoy,
  );
  return { mes: elegido, hoy, semanas, porDia: tareasPorDia(tareas, dias), eventos, proximos };
}
