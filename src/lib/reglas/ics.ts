import { sumarDias } from './fechas';
import { HORA_RECORDATORIO_POR_DEFECTO, type Recordatorio } from './recordatorios';

/**
 * E11d (PLAN_AMPLIACION 5.10; RB-47, S-50): "Agregar a mi calendario". Un archivo .ics (RFC 5545) con la tarea
 * como evento y una alarma por su recordatorio, para que la ponga el propio teléfono. Es una copia: si la tarea
 * cambia en Nova, hay que volver a agregarla (el UID es el de la tarea, así que algunos calendarios la reemplazan).
 */

export const AVISO_COPIA_CALENDARIO =
  'Es una copia: si cambias la tarea en Nova, vuelve a agregarla.';

export interface TareaIcs {
  id: string;
  titulo: string;
  /** AAAA-MM-DD. */
  fechaLimite: string;
  horaInicio?: string | null | undefined;
  horaFin?: string | null | undefined;
  recordatorio?: Recordatorio | null | undefined;
}

const ZONA = 'America/Bogota';
// Bogotá no cambia de hora en el año: UTC−5 siempre.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${ZONA}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0500',
  'TZNAME:-05',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** Texto de una propiedad: barra invertida, punto y coma, coma y saltos de línea van escapados. */
export function escaparTexto(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n|\r/g, '\\n');
}

/** Pliega una línea en trozos de 75 bytes como máximo (UTF-8), sin partir un carácter. */
export function plegarLinea(linea: string): string {
  const partes: string[] = [];
  let actual = '';
  let bytes = 0;
  for (const caracter of linea) {
    const tam = new TextEncoder().encode(caracter).length;
    const limite = partes.length === 0 ? 75 : 74; // las de continuación empiezan con un espacio
    if (bytes + tam > limite) {
      partes.push(actual);
      actual = '';
      bytes = 0;
    }
    actual += caracter;
    bytes += tam;
  }
  partes.push(actual);
  return partes.join('\r\n ');
}

const compacta = (fecha: string) => fecha.slice(0, 10).replace(/-/g, '');
const horaCompacta = (hora: string) => `${hora.slice(0, 2)}${hora.slice(3, 5)}00`;

/** "AAAAMMDDTHHMMSSZ" en UTC. */
function marcaUtc(instante: Date): string {
  return instante
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Minutos desde la medianoche de "HH:MM". */
const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/** Duración ±PT…; "PT0S" para cero. */
function duracion(min: number): string {
  if (min === 0) return 'PT0S';
  const signo = min < 0 ? '-' : '';
  const total = Math.abs(min);
  if (total % (24 * 60) === 0) return `${signo}P${total / (24 * 60)}D`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${signo}PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}`;
}

/**
 * S-50: el disparo de la alarma, relativo al inicio del evento. Con horario cuenta desde la hora de inicio; sin
 * horario el evento es de todo el día (empieza a la medianoche), así que "El mismo día" es +hora fija y "El día
 * anterior" es la hora fija menos un día.
 */
export function disparoAlarma(
  recordatorio: Recordatorio,
  conHorario: boolean,
  horaFija: string = HORA_RECORDATORIO_POR_DEFECTO,
): string {
  if (conHorario)
    return duracion(-{ a_la_hora: 0, '15_min': 15, '1_hora': 60, '1_dia': 24 * 60 }[recordatorio]);
  const fija = minutos(horaFija);
  return duracion(recordatorio === '1_dia' ? fija - 24 * 60 : fija);
}

/** RB-47, S-50: el archivo completo, con líneas CRLF. */
export function generarIcs(
  tarea: TareaIcs,
  opciones: { ahora?: Date; horaFija?: string; enlace?: string; dominio?: string } = {},
): string {
  const fecha = tarea.fechaLimite.slice(0, 10);
  const conHorario = Boolean(tarea.horaInicio);
  const evento: string[] = [
    'BEGIN:VEVENT',
    `UID:tarea-${tarea.id}@${opciones.dominio ?? 'nova-assistant'}`,
    `DTSTAMP:${marcaUtc(opciones.ahora ?? new Date())}`,
  ];
  if (conHorario) {
    evento.push(
      `DTSTART;TZID=${ZONA}:${compacta(fecha)}T${horaCompacta(tarea.horaInicio as string)}`,
    );
    // RB-34: el fin siempre es después del inicio, el mismo día.
    if (tarea.horaFin)
      evento.push(`DTEND;TZID=${ZONA}:${compacta(fecha)}T${horaCompacta(tarea.horaFin)}`);
    // Sin hora de fin, sin DTEND: el evento dura cero minutos (RFC 5545, 3.6.1).
  } else {
    evento.push(
      `DTSTART;VALUE=DATE:${compacta(fecha)}`,
      `DTEND;VALUE=DATE:${compacta(sumarDias(fecha, 1))}`,
      'TRANSP:TRANSPARENT',
    );
  }
  evento.push(`SUMMARY:${escaparTexto(tarea.titulo)}`);
  const descripcion = opciones.enlace
    ? `Tarea de Nova: ${opciones.enlace}\n${AVISO_COPIA_CALENDARIO}`
    : `Tarea de Nova. ${AVISO_COPIA_CALENDARIO}`;
  evento.push(`DESCRIPTION:${escaparTexto(descripcion)}`);
  if (opciones.enlace) evento.push(`URL:${opciones.enlace}`);
  if (tarea.recordatorio) {
    evento.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escaparTexto(tarea.titulo)}`,
      `TRIGGER:${disparoAlarma(tarea.recordatorio, conHorario, opciones.horaFija)}`,
      'END:VALARM',
    );
  }
  evento.push('END:VEVENT');

  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nova Assistant//Tareas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(conHorario ? VTIMEZONE : []),
    ...evento,
    'END:VCALENDAR',
  ];
  return `${lineas.map(plegarLinea).join('\r\n')}\r\n`;
}

/** Un nombre de archivo seguro y legible: "clase-de-calculo.ics". */
export function nombreArchivoIcs(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
  return `${base || 'tarea'}.ics`;
}
