import { pestanasSemestre } from '@/components/nova/semestre/pestanas';
import { CalendarDays, ChartColumn, FileText, GraduationCap, House, ListChecks, MessageCircle, Settings, ShieldCheck, type LucideIcon } from 'lucide-react';

/**
 * Secciones de Nova (PLAN_AMPLIACION 4.1). Solo las que ya existen: una sección entra al menú en la etapa
 * en que se construye (regla "sin botones muertos"). Calendario entró en E07 y Fuentes en E10 (reemplaza a
 * Documentos y Web), Configuración en E11 y Semestre en E12. Las categorías viven en
 * Tareas desde E05b.
 */
export interface Seccion {
  href: string;
  texto: string;
  icono: LucideIcon;
}

export const SECCIONES = {
  inicio: { href: '/nova', texto: 'Inicio', icono: House },
  asistente: { href: '/nova/asistente', texto: 'Asistente', icono: MessageCircle },
  calendario: { href: '/nova/calendario', texto: 'Calendario', icono: CalendarDays },
  tareas: { href: '/nova/tareas', texto: 'Tareas', icono: ListChecks },
  fuentes: { href: '/nova/fuentes', texto: 'Fuentes', icono: FileText },
  productividad: { href: '/nova/productividad', texto: 'Productividad', icono: ChartColumn },
  semestre: { href: '/nova/semestre', texto: 'Semestre', icono: GraduationCap },
  configuracion: { href: '/nova/configuracion', texto: 'Configuración', icono: Settings },
  administracion: { href: '/nova/administracion', texto: 'Administración', icono: ShieldCheck },
} satisfies Record<string, Seccion>;

/** Barra lateral (computador): todas las secciones disponibles, en el orden del plan. */
export const MENU_LATERAL: Seccion[] = [
  SECCIONES.inicio,
  SECCIONES.asistente,
  SECCIONES.calendario,
  SECCIONES.tareas,
  SECCIONES.fuentes,
  SECCIONES.productividad,
  SECCIONES.semestre,
  SECCIONES.configuracion,
];

/**
 * Barra inferior (teléfono): Inicio, [Calendario], Asistente al centro, Tareas y "Más".
 * Desde E07 Calendario ocupa su lugar; Fuentes y Productividad están en la hoja "Más".
 */
export const BARRA_INFERIOR: { izquierda: Seccion[]; centro: Seccion; derecha: Seccion[] } = {
  izquierda: [SECCIONES.inicio, SECCIONES.calendario],
  centro: SECCIONES.asistente,
  derecha: [SECCIONES.tareas],
};

/** E20b: las pestañas de Semestre, como submenú de la barra lateral (las mismas de semestre/pestanas.ts). */
export const SUBMENU_SEMESTRE: Array<{ href: string; texto: string }> = pestanasSemestre('notas').map(({ href, texto }) => ({ href, texto }));

/** Hoja "Más": las secciones que no caben en la barra inferior. */
export const MENU_MAS: Seccion[] = [SECCIONES.fuentes, SECCIONES.productividad, SECCIONES.semestre, SECCIONES.configuracion];

/**
 * E20c-2 (RB-83): "Administración" aparece al final de la barra lateral y de "Más" solo para los administradores (y
 * el dueño). Para cualquier otra cuenta no está en el menú, su página no existe y su API responde 403.
 */
export const menuLateral = (administrador: boolean): Seccion[] => (administrador ? [...MENU_LATERAL, SECCIONES.administracion] : MENU_LATERAL);
export const menuMas = (administrador: boolean): Seccion[] => (administrador ? [...MENU_MAS, SECCIONES.administracion] : MENU_MAS);

/** Inicio solo está activo en /nova exacto; las demás, también en sus subrutas (/nova/tareas/nueva). */
export function esActivo(ruta: string, href: string): boolean {
  return href === '/nova' ? ruta === '/nova' : ruta === href || ruta.startsWith(`${href}/`);
}
