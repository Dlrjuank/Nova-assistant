import { ChartColumn, FileText, Globe, House, ListChecks, MessageCircle, type LucideIcon } from 'lucide-react';

/**
 * Secciones de Nova (PLAN_AMPLIACION 4.1). Solo las que ya existen: una sección entra al menú en la etapa
 * en que se construye (regla "sin botones muertos"). Calendario (E07), Fuentes (E10, reemplaza a
 * Documentos y Web), Semestre (E12) y Configuración (E11) se agregan en sus etapas. Las categorías viven en
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
  tareas: { href: '/nova/tareas', texto: 'Tareas', icono: ListChecks },
  documentos: { href: '/nova/documentos', texto: 'Documentos', icono: FileText },
  web: { href: '/nova/web', texto: 'Web', icono: Globe },
  productividad: { href: '/nova/productividad', texto: 'Productividad', icono: ChartColumn },
} satisfies Record<string, Seccion>;

/** Barra lateral (computador): todas las secciones disponibles, en el orden del plan. */
export const MENU_LATERAL: Seccion[] = [
  SECCIONES.inicio,
  SECCIONES.asistente,
  SECCIONES.tareas,
  SECCIONES.documentos,
  SECCIONES.web,
  SECCIONES.productividad,
];

/**
 * Barra inferior (teléfono): Inicio, [Calendario], Asistente al centro, Tareas y "Más".
 * Mientras Calendario no exista (E07), su lugar lo ocupa Documentos.
 */
export const BARRA_INFERIOR: { izquierda: Seccion[]; centro: Seccion; derecha: Seccion[] } = {
  izquierda: [SECCIONES.inicio, SECCIONES.documentos],
  centro: SECCIONES.asistente,
  derecha: [SECCIONES.tareas],
};

/** Hoja "Más": las secciones que no caben en la barra inferior. */
export const MENU_MAS: Seccion[] = [SECCIONES.web, SECCIONES.productividad];

/** Inicio solo está activo en /nova exacto; las demás, también en sus subrutas (/nova/tareas/nueva). */
export function esActivo(ruta: string, href: string): boolean {
  return href === '/nova' ? ruta === '/nova' : ruta === href || ruta.startsWith(`${href}/`);
}
