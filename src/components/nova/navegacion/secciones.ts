import { CalendarDays, ChartColumn, FileText, House, ListChecks, MessageCircle, Settings, type LucideIcon } from 'lucide-react';

/**
 * Secciones de Nova (PLAN_AMPLIACION 4.1). Solo las que ya existen: una sección entra al menú en la etapa
 * en que se construye (regla "sin botones muertos"). Calendario entró en E07 y Fuentes en E10 (reemplaza a
 * Documentos y Web) y Configuración en E11; Semestre (E12) se agrega en su etapa. Las categorías viven en
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
  configuracion: { href: '/nova/configuracion', texto: 'Configuración', icono: Settings },
} satisfies Record<string, Seccion>;

/** Barra lateral (computador): todas las secciones disponibles, en el orden del plan. */
export const MENU_LATERAL: Seccion[] = [
  SECCIONES.inicio,
  SECCIONES.asistente,
  SECCIONES.calendario,
  SECCIONES.tareas,
  SECCIONES.fuentes,
  SECCIONES.productividad,
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

/** Hoja "Más": las secciones que no caben en la barra inferior. */
export const MENU_MAS: Seccion[] = [SECCIONES.fuentes, SECCIONES.productividad, SECCIONES.configuracion];

/** Inicio solo está activo en /nova exacto; las demás, también en sus subrutas (/nova/tareas/nueva). */
export function esActivo(ruta: string, href: string): boolean {
  return href === '/nova' ? ruta === '/nova' : ruta === href || ruta.startsWith(`${href}/`);
}
