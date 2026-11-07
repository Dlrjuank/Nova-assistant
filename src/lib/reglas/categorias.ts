import { CATEGORIA_POR_DEFECTO } from '@/lib/config/nova';
import { ErrorDeNegocio } from './errores';

/** PLAN_AMPLIACION 3.1: paleta fija de 8 colores (cada uno con su versión clara y oscura en globals.css). */
export const PALETA_CATEGORIAS = ['terracota', 'ambar', 'oliva', 'verde', 'azul', 'violeta', 'rosa', 'gris'] as const;
export type ColorCategoria = (typeof PALETA_CATEGORIAS)[number];

export const NOMBRE_COLOR: Record<ColorCategoria, string> = {
  terracota: 'Terracota',
  ambar: 'Ámbar',
  oliva: 'Oliva',
  verde: 'Verde',
  azul: 'Azul',
  violeta: 'Violeta',
  rosa: 'Rosa',
  gris: 'Gris',
};

/** Color de lo que no tiene categoría registrada (y de General). */
export const COLOR_SIN_CATEGORIA: ColorCategoria = 'gris';
export const NOMBRE_MAXIMO_CATEGORIA = 80;

export function esColorCategoria(valor: unknown): valor is ColorCategoria {
  return typeof valor === 'string' && (PALETA_CATEGORIAS as readonly string[]).includes(valor);
}

export function esGeneral(nombre: string): boolean {
  return nombre.trim().toLowerCase() === CATEGORIA_POR_DEFECTO.toLowerCase();
}

/** RB-02: recortado, de 1 a 80 caracteres. Devuelve el nombre limpio. */
export function validarNombreCategoria(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (limpio.length < 1 || limpio.length > NOMBRE_MAXIMO_CATEGORIA) throw new ErrorDeNegocio('NOMBRE_CATEGORIA_INVALIDO');
  return limpio;
}

/** RB-03: uno de la paleta fija. */
export function validarColorCategoria(color: unknown): ColorCategoria {
  if (!esColorCategoria(color)) throw new ErrorDeNegocio('COLOR_INVALIDO');
  return color;
}

/**
 * El siguiente color libre de la paleta, en orden y sin gris (que queda para General y lo no registrado).
 * Si ya se usaron todos, se vuelve a empezar según cuántas categorías hay.
 */
export function siguienteColorLibre(usados: readonly string[]): ColorCategoria {
  const opciones = PALETA_CATEGORIAS.filter((c) => c !== COLOR_SIN_CATEGORIA);
  const libre = opciones.find((c) => !usados.includes(c));
  return libre ?? opciones[usados.length % opciones.length] ?? COLOR_SIN_CATEGORIA;
}

/** Color de una tarea según el nombre de su categoría (sin distinguir mayúsculas); sin registro, gris. */
export function colorDeCategoria(nombre: string, categorias: ReadonlyArray<{ nombre: string; color: string }>): ColorCategoria {
  const clave = nombre.trim().toLowerCase();
  const encontrada = categorias.find((c) => c.nombre.toLowerCase() === clave);
  return encontrada && esColorCategoria(encontrada.color) ? encontrada.color : COLOR_SIN_CATEGORIA;
}
