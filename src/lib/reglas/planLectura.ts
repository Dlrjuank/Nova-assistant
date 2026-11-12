import { ErrorDeNegocio } from './errores';
import { esFechaISOValida, sumarDias } from './fechas';
import { citaDePaginas } from './libros';

/** E10d (PLAN_AMPLIACION 5.9, RB-42): plan de lectura por capítulos. Funciones puras. */

export const PRIORIDAD_PLAN_LECTURA = 2; // Media
export const MAX_POR_SEMANA = 20;
const MAX_TITULO = 200;

export type ModoPlan = { modo: 'fechas'; inicio: string; fin: string } | { modo: 'semana'; inicio: string; porSemana: number };

function diasEntre(desde: string, hasta: string): number {
  const utc = (f: string) => {
    const [a, m, d] = f.split('-').map(Number) as [number, number, number];
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((utc(hasta) - utc(desde)) / 86_400_000);
}

/** RB-42: fechas reales y la final igual o posterior a la de inicio. */
export function validarPlan(p: ModoPlan): void {
  if (!esFechaISOValida(p.inicio)) throw new ErrorDeNegocio('FECHA_INVALIDA');
  if (p.modo === 'fechas') {
    if (!esFechaISOValida(p.fin)) throw new ErrorDeNegocio('FECHA_INVALIDA');
    if (p.fin < p.inicio) throw new ErrorDeNegocio('PLAN_FECHAS_INVERTIDAS');
  } else if (!Number.isInteger(p.porSemana) || p.porSemana < 1 || p.porSemana > MAX_POR_SEMANA) {
    throw new ErrorDeNegocio('DATOS_INVALIDOS');
  }
}

/** El elemento i de n, repartidos en `dias` días desde `inicio`, vence el último día de su tramo. */
function finDeTramo(inicio: string, dias: number, n: number, i: number): string {
  return sumarDias(inicio, Math.ceil(((i + 1) * dias) / n) - 1);
}

/**
 * RB-42: la fecha límite de cada uno de `n` capítulos, en orden. Entre dos fechas, cada capítulo tiene un tramo
 * igual y el último vence el día final; con varios por día si no alcanzan los días. Por semana, cada semana
 * (desde la fecha de inicio) reparte sus capítulos en sus 7 días.
 */
export function repartirFechas(n: number, p: ModoPlan): string[] {
  validarPlan(p);
  const indices = Array.from({ length: n }, (_, i) => i);
  if (p.modo === 'fechas') {
    const dias = diasEntre(p.inicio, p.fin) + 1;
    return indices.map((i) => finDeTramo(p.inicio, dias, n, i));
  }
  return indices.map((i) => {
    const semana = Math.floor(i / p.porSemana);
    const enSemana = Math.min(p.porSemana, n - semana * p.porSemana);
    return finDeTramo(sumarDias(p.inicio, 7 * semana), 7, enSemana, i % p.porSemana);
  });
}

const PREFIJO_CAPITULO = /^(?:cap[ií]tulo|cap\.?)\s*(\d+)\s*[.:\-–—]?\s*/i;

/** El número que trae el título ("Capítulo 3. Los ecosistemas"), si lo trae. */
export function numeroEnTitulo(titulo: string): number | null {
  const m = PREFIJO_CAPITULO.exec(titulo.trim());
  return m ? Number(m[1]) : null;
}

/**
 * "Leer cap. 3: Los ecosistemas (pp. 45–67)", sin repetir "Capítulo 3" y en 200 caracteres como máximo.
 * E10f (RB-53) usa el mismo formato con "Repasar".
 */
export function tituloTareaCapitulo(numero: number, titulo: string, etiquetaPaginas: string, verbo: 'Leer' | 'Repasar' = 'Leer'): string {
  const limpio = titulo.trim().replace(PREFIJO_CAPITULO, '').trim() || titulo.trim();
  const inicio = `${verbo} cap. ${numero}: `;
  const paginas = ` (${citaDePaginas(etiquetaPaginas)})`;
  const espacio = MAX_TITULO - inicio.length - paginas.length;
  const recortado = limpio.length > espacio ? `${limpio.slice(0, espacio - 1).trimEnd()}…` : limpio;
  return `${inicio}${recortado}${paginas}`;
}

/** Número de cada capítulo de nivel 1: el del título, o su posición entre los de nivel 1. */
export function numerarCapitulos<T extends { orden: number; nivel: number; titulo: string }>(capitulos: readonly T[]): Map<number, number> {
  const numeros = new Map<number, number>();
  let posicion = 0;
  for (const c of capitulos) {
    if (c.nivel !== 1) continue;
    posicion += 1;
    numeros.set(c.orden, numeroEnTitulo(c.titulo) ?? posicion);
  }
  return numeros;
}
