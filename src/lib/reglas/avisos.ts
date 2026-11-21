import { sumarDias } from './fechas';

/**
 * E20b (commit 1, base y navegación): lo que muestra la navegación además de las secciones: el globo de Tareas
 * con las vencidas y la tarjeta de aviso de la barra lateral (una tarea vencida o el próximo corte).
 */
export interface DatosAvisos {
  /** El nombre del perfil (Configuración); vacío si no lo ha puesto. */
  nombre: string;
  /** Tareas sin completar con fecha límite antes de hoy (Bogotá). */
  vencidas: number;
  /** El corte con fecha más próximo, desde hoy. */
  proximoCorte: { materiaId: string; materia: string; corte: string; fecha: string } | null;
}

export interface AvisoLateral {
  etiqueta: string;
  titulo: string;
  texto: string;
  href: string;
}

const DIA = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric' });
const FECHA = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'long' });

/** "Hoy", "Mañana", "El viernes 20" (en los próximos 6 días) o "El 12 de diciembre". `fecha` y `hoy` en AAAA-MM-DD. */
export function cuandoEs(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  const dia = new Date(`${fecha}T00:00:00Z`);
  return fecha <= sumarDias(hoy, 6) ? `El ${DIA.format(dia).replace(',', '')}` : `El ${FECHA.format(dia)}`;
}

/** La tarjeta de aviso: primero las vencidas (lo urgente); si no hay, el próximo corte; si tampoco, ninguna. */
export function avisoLateral(d: Pick<DatosAvisos, 'vencidas' | 'proximoCorte'>, hoy: string): AvisoLateral | null {
  if (d.vencidas > 0) {
    return {
      etiqueta: 'Aviso',
      titulo: d.vencidas === 1 ? '1 tarea vencida' : `${d.vencidas} tareas vencidas`,
      texto: d.vencidas === 1 ? 'Revísala en Tareas.' : 'Revísalas en Tareas.',
      href: '/nova/tareas?vista=vencidas',
    };
  }
  if (d.proximoCorte) {
    const c = d.proximoCorte;
    return { etiqueta: 'Próximo corte', titulo: `${c.corte} de ${c.materia}`, texto: `${cuandoEs(c.fecha, hoy)}.`, href: `/nova/semestre/${c.materiaId}` };
  }
  return null;
}

/** El nombre para el perfil: el de Configuración o, si no hay, lo que va antes de la @ del correo. */
export function nombrePerfil(nombre: string, email: string): string {
  return nombre.trim() || email.split('@')[0] || email;
}

/** La inicial del avatar, en mayúscula. */
export function inicialPerfil(nombre: string): string {
  return (nombre.trim().charAt(0) || '·').toLocaleUpperCase('es-CO');
}
