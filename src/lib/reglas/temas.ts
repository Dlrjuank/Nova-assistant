import { ErrorDeNegocio } from './errores';

/**
 * E17 (PLAN_AMPLIACION 6.8, 9.1; RB-19, RB-21): reglas puras de los temas de un corte. Un tema manual nace
 * confirmado; uno del asistente nace propuesto con la etiqueta del fragmento del PDF y solo cuenta al confirmarlo.
 */

export const MAX_NOMBRE_TEMA = 200;
export const MAX_TEMAS_PROPUESTOS = 15;
/** 9.1: hasta 6 fragmentos del PDF elegido. */
export const FRAGMENTOS_PARA_TEMAS = 6;

export type OrigenTema = 'manual' | 'asistente';
export type EstadoTema = 'propuesto' | 'confirmado';

/** Recorta y une los espacios; de 1 a 200 caracteres. */
export function validarNombreTema(v: string): string {
  const nombre = v.trim().replace(/\s+/g, ' ');
  if (nombre.length < 1 || nombre.length > MAX_NOMBRE_TEMA) throw new ErrorDeNegocio('TEMA_NOMBRE_INVALIDO');
  return nombre;
}

/** Para comparar: sin mayúsculas, sin tildes ni espacios de más ("Límites" = "limites"). */
const clave = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

/** RB-19: generar temas (o el plan, E18) pide un corte con fecha futura, en Bogotá ('YYYY-MM-DD'). */
export function corteConFechaFutura(fecha: string | null, hoy: string): boolean {
  return fecha !== null && fecha > hoy;
}

/** Lo que el modelo puede pedir para una materia: "del Corte 2 de Cálculo" o, sin cortes, "de Cálculo". */
export function descripcionCorte(materia: string, corte: string, usaCortes: boolean): string {
  return usaCortes ? `del ${corte} de ${materia}` : `de ${materia}`;
}

export interface TemaPropuesto {
  nombre: string;
  /** La etiqueta que se guarda: "syllabus.pdf · p. 2". */
  fuente: string;
}

/**
 * 9.1 paso 3: se queda con los temas que citan una etiqueta entregada ("F1"…), con un nombre válido, sin repetir
 * entre ellos ni con los que el corte ya tiene (sin mayúsculas), y como mucho 15. La fuente pasa a la etiqueta
 * legible del fragmento. Lo demás se descarta sin error: el modelo no decide qué se guarda.
 */
export function validarTemasPropuestos(crudos: unknown, etiquetas: ReadonlyMap<string, string>, existentes: readonly string[]): TemaPropuesto[] {
  if (!Array.isArray(crudos)) return [];
  const vistos = new Set(existentes.map(clave));
  const validos: TemaPropuesto[] = [];
  for (const c of crudos) {
    if (validos.length >= MAX_TEMAS_PROPUESTOS) break;
    if (typeof c !== 'object' || c === null) continue;
    const { nombre, fuente } = c as { nombre?: unknown; fuente?: unknown };
    if (typeof nombre !== 'string' || typeof fuente !== 'string') continue;
    const legible = etiquetas.get(fuente.trim());
    if (!legible) continue; // fuente inventada
    let limpio: string;
    try {
      limpio = validarNombreTema(nombre);
    } catch {
      continue;
    }
    if (vistos.has(clave(limpio))) continue;
    vistos.add(clave(limpio));
    validos.push({ nombre: limpio, fuente: legible });
  }
  return validos;
}

/** "3 temas confirmados", "1 tema confirmado", "Sin temas confirmados". */
export function textoConfirmados(n: number): string {
  if (n === 0) return 'Sin temas confirmados';
  return n === 1 ? '1 tema confirmado' : `${n} temas confirmados`;
}
