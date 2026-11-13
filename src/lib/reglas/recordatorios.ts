import type { FormatoHora } from '@/lib/reglas/preferencias';
import { ErrorDeNegocio } from './errores';
import { sumarDias } from './fechas';
import { formatearHorario } from './horario';

/**
 * E11c (PLAN_AMPLIACION 5.10, 7.10; RB-43 a RB-45): recordatorios de las tareas. Funciones puras, compartidas por
 * el servidor y el navegador. Las horas son de Bogotá, que no cambia de hora en el año (UTC−5).
 */

export type Recordatorio = 'a_la_hora' | '15_min' | '1_hora' | '1_dia';
export type EstadoRecordatorio = 'pendiente' | 'enviado' | 'omitido';

const DESFASE_BOGOTA = '-05:00';
export const HORA_RECORDATORIO_POR_DEFECTO = '08:00';
/** 7.10: los que se atrasaron más que esto (por ejemplo, con la base pausada) no se envían. */
export const VENTANA_ENVIO_MS = 30 * 60 * 1000;

export const AVISO_MOMENTO_PASADO = 'Ese momento ya pasó: no se enviará el recordatorio.';
// RB-45.
export const AVISO_IPHONE_SIN_INSTALAR = 'Para recibir avisos en el iPhone, primero agrega Nova a inicio.';
export const AVISO_BLOQUEADAS = 'Las notificaciones están bloqueadas. Actívalas en los ajustes del teléfono para Nova.';
export const AVISO_ACTIVAR = 'Activa las notificaciones para recibir este aviso.';

const CON_HORARIO: ReadonlyArray<{ valor: Recordatorio; texto: string }> = [
  { valor: 'a_la_hora', texto: 'A la hora' },
  { valor: '15_min', texto: '15 min antes' },
  { valor: '1_hora', texto: '1 hora antes' },
  { valor: '1_dia', texto: '1 día antes' },
];
const SIN_HORARIO: ReadonlyArray<{ valor: Recordatorio; texto: string }> = [
  { valor: 'a_la_hora', texto: 'El mismo día' },
  { valor: '1_dia', texto: 'El día anterior' },
];

/** RB-43: con horario, 4 opciones (de la hora de inicio); sin horario, 2 a la hora fija de Configuración. */
export function opcionesRecordatorio(conHorario: boolean, horaFija: string = HORA_RECORDATORIO_POR_DEFECTO, formato: FormatoHora = '24') {
  if (conHorario) return CON_HORARIO;
  const hora = formatearHorario({ horaInicio: horaFija }, formato);
  return SIN_HORARIO.map((o) => ({ ...o, texto: `${o.texto}, a las ${hora}` }));
}

export function esRecordatorio(valor: unknown): valor is Recordatorio {
  return valor === 'a_la_hora' || valor === '15_min' || valor === '1_hora' || valor === '1_dia';
}

/** RB-43: null (sin recordatorio) o una opción válida para la tarea; "15 min" y "1 hora" necesitan horario. */
export function validarRecordatorio(valor: unknown, horaInicio: string | null | undefined): Recordatorio | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (!esRecordatorio(valor)) throw new ErrorDeNegocio('DATOS_INVALIDOS');
  if (!horaInicio && (valor === '15_min' || valor === '1_hora')) throw new ErrorDeNegocio('RECORDATORIO_INVALIDO');
  return valor;
}

/** "HH:MM" de 24 horas, de 00:00 a 23:59 (la hora fija de Configuración). */
export function validarHoraRecordatorio(hora: unknown): string {
  if (typeof hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new ErrorDeNegocio('HORA_RECORDATORIO_INVALIDA');
  return hora;
}

/** El instante de una fecha y hora de Bogotá. */
function enBogota(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora.slice(0, 5)}:00${DESFASE_BOGOTA}`);
}

/**
 * Regla 7.10: el momento del aviso. Con horario cuenta desde la hora de inicio; sin horario, a la hora fija del
 * mismo día o del anterior. Cruza bien la medianoche, el fin de mes y el fin de año (la resta es de instantes).
 */
export function momentoRecordatorio(d: {
  recordatorio: Recordatorio;
  fechaLimite: string;
  horaInicio?: string | null | undefined;
  horaFija?: string | undefined;
}): Date {
  const fecha = d.fechaLimite.slice(0, 10);
  if (d.horaInicio) {
    const inicio = enBogota(fecha, d.horaInicio).getTime();
    const antes = { a_la_hora: 0, '15_min': 15 * 60_000, '1_hora': 60 * 60_000, '1_dia': 24 * 60 * 60_000 }[d.recordatorio];
    return new Date(inicio - antes);
  }
  const hora = d.horaFija ?? HORA_RECORDATORIO_POR_DEFECTO;
  if (d.recordatorio === '1_dia') return enBogota(sumarDias(fecha, -1), hora);
  if (d.recordatorio === 'a_la_hora') return enBogota(fecha, hora);
  throw new ErrorDeNegocio('RECORDATORIO_INVALIDO');
}

/** 7.10: si al guardar la hora ya pasó, el recordatorio queda omitido (la tarea se guarda con el aviso de RB-43). */
export function estadoInicial(momento: Date, ahora: Date): EstadoRecordatorio {
  return momento.getTime() <= ahora.getTime() ? 'omitido' : 'pendiente';
}

/** 7.10: en el aviso de cada minuto, qué hacer con un recordatorio pendiente. */
export function decisionEnvio(momento: Date, ahora: Date): 'esperar' | 'enviar' | 'omitir' {
  const diferencia = ahora.getTime() - momento.getTime();
  if (diferencia < 0) return 'esperar';
  return diferencia <= VENTANA_ENVIO_MS ? 'enviar' : 'omitir';
}

/** RB-44: el texto exacto de la notificación (el título es "Nova"). */
export function textoNotificacion(
  d: { recordatorio: Recordatorio; titulo: string; horaInicio?: string | null | undefined; horaFin?: string | null | undefined },
  formato: FormatoHora = '24',
): string {
  if (!d.horaInicio) return `${d.recordatorio === '1_dia' ? 'Mañana' : 'Hoy'}: ${d.titulo}`;
  const cuando = { a_la_hora: 'Ahora', '15_min': 'En 15 min', '1_hora': 'En 1 hora', '1_dia': 'Mañana' }[d.recordatorio];
  return `${cuando}: ${d.titulo} (${formatearHorario({ horaInicio: d.horaInicio, horaFin: d.horaFin ?? null }, formato)})`;
}

/** Al quitar la hora de inicio, "15 min" y "1 hora" dejan de tener sentido: el campo vuelve a "Sin recordatorio". */
export function recordatorioCompatible(valor: Recordatorio | '', conHorario: boolean): Recordatorio | '' {
  return !conHorario && (valor === '15_min' || valor === '1_hora') ? '' : valor;
}

/** La dirección que abre una notificación: Tareas con esa tarea resaltada. */
export function rutaDeTarea(id: string): string {
  return `/nova/tareas?tarea=${encodeURIComponent(id)}`;
}
