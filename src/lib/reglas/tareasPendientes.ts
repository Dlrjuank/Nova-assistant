import { CATEGORIA_POR_DEFECTO } from '@/lib/config/nova';
import { validarNombreCategoria } from './categorias';
import { validarHorario } from './horario';
import { validarRecordatorio } from './recordatorios';
import { validarTarea } from './tarea';

/**
 * E11e (PLAN_AMPLIACION 5.13, 7.14; RB-70 a RB-75): tareas creadas sin conexión. Funciones puras, compartidas
 * por el navegador y las pruebas. Lo pendiente vive en el dispositivo (IndexedDB); la base solo recibe la tarea
 * cuando se envía, con su `idCliente`.
 */

export const MAX_PENDIENTES = 50;

export const GUARDADA_EN_DISPOSITIVO = 'Guardada en este dispositivo. Se enviará cuando vuelva la conexión.';
export const TOPE_PENDIENTES = 'Ya tienes 50 tareas sin enviar. Conéctate para enviarlas antes de crear más.';
export const INSIGNIA_PENDIENTE = 'Pendiente de enviar';
export const CONFIRMAR_DESCARTAR = '¿Descartar esta tarea? No se enviará.';
export const BOTON_CERRAR_Y_BORRAR = 'Cerrar sesión y borrarlas';

export interface DatosPendiente {
  titulo: string;
  categoria: string;
  prioridad: number;
  fechaLimite: string;
  horaInicio: string | null;
  horaFin: string | null;
  recordatorio: string | null;
}

export interface TareaPendiente {
  /** El identificador que le dio el dispositivo (UUID); viaja en cada reintento y al "Corregir". */
  idCliente: string;
  /** RB-75: solo se envía con la sesión de este usuario. */
  usuarioId: string;
  /** Milisegundos: se envían en el orden en que se crearon. */
  creadaEn: number;
  datos: DatosPendiente;
  estado: 'pendiente' | 'rechazada';
  /** RB-74: el mensaje exacto del servidor, si la rechazó. */
  error?: string;
}

/** RB-71: `{n} tareas pendientes de enviar`. */
export function textoPendientesDeEnviar(n: number): string {
  return n === 1 ? '1 tarea pendiente de enviar' : `${n} tareas pendientes de enviar`;
}

/** RB-72: el aviso al terminar de enviar. */
export function textoEnviadas(n: number): string {
  return n === 1 ? 'Se envió 1 tarea que creaste sin conexión.' : `Se enviaron ${n} tareas que creaste sin conexión.`;
}

/** RB-73: el recordatorio ya pasó cuando la tarea llegó al servidor. */
export function textoRecordatorioPasado(titulo: string): string {
  return `El recordatorio de «${titulo}» no se enviará: su momento pasó mientras estaba sin conexión.`;
}

/** RB-74. */
export function textoNoSeEnvio(mensaje: string): string {
  return `No se pudo enviar: ${mensaje}`;
}

/** RB-75: el aviso antes de cerrar sesión. */
export function textoCerrarSesion(n: number): string {
  return n === 1
    ? 'Tienes 1 tarea sin enviar. Si cierras sesión, se borrará de este dispositivo.'
    : `Tienes ${n} tareas sin enviar. Si cierras sesión, se borrarán de este dispositivo.`;
}

/**
 * RB-70: las mismas reglas del servidor (RN-04 a RN-08, RB-33, RB-34, RB-43), para no guardar en el dispositivo
 * algo que el servidor rechazaría. Lanza ErrorDeNegocio con el mensaje exacto.
 */
export function validarPendiente(d: DatosPendiente): void {
  validarTarea(d);
  const { horaInicio } = validarHorario(d.horaInicio, d.horaFin);
  validarRecordatorio(d.recordatorio, horaInicio);
  if (d.categoria.trim() && d.categoria.trim() !== CATEGORIA_POR_DEFECTO) validarNombreCategoria(d.categoria);
}

/** RB-70: ¿cabe una más? Al "Corregir" una que ya estaba, no cuenta dos veces. */
export function cabeOtraPendiente(pendientes: ReadonlyArray<Pick<TareaPendiente, 'idCliente'>>, idCliente: string): boolean {
  return pendientes.some((t) => t.idCliente === idCliente) || pendientes.length < MAX_PENDIENTES;
}

export type ResultadoEnvio = 'enviada' | 'rechazada' | 'detener' | 'reintentar';

/**
 * 7.14: qué hacer según la respuesta. 200 o 201: se borra del dispositivo. 400 o 422 (validación): queda
 * "No se pudo enviar" y no se reintenta sola. 401 o 403: se detiene sin borrar nada (se reintenta con sesión).
 * Red o 5xx (y cualquier otra respuesta): queda pendiente y se reintenta.
 */
export function decidirResultado(estado: number): ResultadoEnvio {
  if (estado === 200 || estado === 201) return 'enviada';
  if (estado === 400 || estado === 422) return 'rechazada';
  if (estado === 401 || estado === 403) return 'detener';
  return 'reintentar';
}

/** Las que se envían ahora: del usuario de la sesión, pendientes (no rechazadas), en orden de creación. */
export function porEnviar(lista: ReadonlyArray<TareaPendiente>, usuarioId: string): TareaPendiente[] {
  return lista.filter((t) => t.usuarioId === usuarioId && t.estado === 'pendiente').sort((a, b) => a.creadaEn - b.creadaEn);
}
