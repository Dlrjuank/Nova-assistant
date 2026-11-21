import { sumarDias } from './fechas';

/**
 * E20b (commit 2, Inicio): los textos del saludo y de las tarjetas de números. Todo con la fecha y la hora de
 * Bogotá, como el resto de la app.
 */

/** "Buenos días" hasta las 11:59, "Buenas tardes" hasta las 18:59 y "Buenas noches" después. */
export function saludo(hora: number): string {
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/** La hora (0 a 23) en Bogotá. */
export function horaBogota(reloj: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', hourCycle: 'h23' }).format(reloj));
}

/** Número de semana ISO 8601 (la semana va de lunes a domingo; la 1 es la del primer jueves del año). */
export function semanaIso(fecha: string): number {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); // el jueves de esa semana decide el año
  const inicioAnio = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - inicioAnio) / 86400000 + 1) / 7);
}

const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });

/** "Sábado 21 de noviembre · semana 47". */
export function fechaConSemana(hoy: string): string {
  const texto = FECHA_LARGA.format(new Date(`${hoy}T00:00:00Z`)).replace(',', '');
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} · semana ${semanaIso(hoy)}`;
}

/** Minutos en horas y minutos para el número grande: 400 → { horas: 6, minutos: 40 }. */
export function partesTiempo(minutos: number): { horas: number; minutos: number } {
  const m = Math.max(0, Math.round(minutos));
  return { horas: Math.floor(m / 60), minutos: m % 60 };
}

/** "6 h 40 min", "45 min", "2 h" o "0 min". */
export function textoTiempo(minutos: number): string {
  const { horas, minutos: m } = partesTiempo(minutos);
  if (horas === 0) return `${m} min`;
  return m === 0 ? `${horas} h` : `${horas} h ${m} min`;
}

/**
 * La diferencia con la semana pasada hasta el mismo día (lunes a hoy contra lunes a hoy − 7), para comparar lo
 * mismo: "+1 h 10 min", "−20 min" o "Igual". Con las dos en 0, null (no hay nada que comparar).
 */
export function diferenciaTiempo(estaSemana: number, semanaPasada: number): { texto: string; tono: 'sube' | 'baja' | 'igual' } | null {
  if (estaSemana === 0 && semanaPasada === 0) return null;
  const d = estaSemana - semanaPasada;
  if (d === 0) return { texto: 'Igual', tono: 'igual' };
  return { texto: `${d > 0 ? '+' : '−'}${textoTiempo(Math.abs(d))}`, tono: d > 0 ? 'sube' : 'baja' };
}

/** Bajo el número de tareas de hoy: "2 pendientes · 1 con horario", "Todas completadas" o "Nada para hoy". */
export function textoTareasHoy(total: number, pendientes: number, conHorario: number): string {
  if (total === 0) return 'Nada para hoy';
  if (pendientes === 0) return 'Todas completadas';
  const partes = [pendientes === 1 ? '1 pendiente' : `${pendientes} pendientes`];
  if (conHorario > 0) partes.push(conHorario === 1 ? '1 con horario' : `${conHorario} con horario`);
  return partes.join(' · ');
}

/** Bajo las vencidas: la más antigua y desde cuándo ("Ensayo de ética, desde ayer"), o "Ninguna, vas al día". */
export function textoVencida(masAntigua: { titulo: string; fecha: string } | null, hoy: string): string {
  if (!masAntigua) return 'Ninguna, vas al día';
  const desde = masAntigua.fecha === sumarDias(hoy, -1) ? 'ayer' : cuandoEsPasado(masAntigua.fecha, hoy);
  return `${masAntigua.titulo}, desde ${desde}`;
}

/** "el viernes 14" (en los últimos 6 días) o "el 2 de noviembre". */
function cuandoEsPasado(fecha: string, hoy: string): string {
  const dia = new Date(`${fecha}T00:00:00Z`);
  if (fecha >= sumarDias(hoy, -6)) return `el ${new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric' }).format(dia).replace(',', '')}`;
  return `el ${new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(dia)}`;
}

/** Bajo el anillo (cambio pedido en la presentación): "Faltan 3", "Falta 1" o "Semana completa"; sin tareas, null. */
export function textoFaltan(total: number, completadas: number): string | null {
  if (total === 0) return null;
  const faltan = total - completadas;
  if (faltan <= 0) return 'Semana completa';
  return faltan === 1 ? 'Falta 1' : `Faltan ${faltan}`;
}

/** Debajo del saludo, un resumen corto del día: "Hoy tienes 2 tareas pendientes y 1 vencida." */
export function resumenDelDia(pendientesHoy: number, vencidas: number): string {
  const hoy = pendientesHoy === 0 ? '' : pendientesHoy === 1 ? '1 tarea pendiente' : `${pendientesHoy} tareas pendientes`;
  const atras = vencidas === 0 ? '' : vencidas === 1 ? '1 vencida' : `${vencidas} vencidas`;
  if (hoy && atras) return `Hoy tienes ${hoy} y ${atras}.`;
  if (hoy) return `Hoy tienes ${hoy}.`;
  if (atras) return `Hoy no tienes tareas pendientes, pero tienes ${atras}.`;
  return 'Hoy no tienes tareas pendientes.';
}
