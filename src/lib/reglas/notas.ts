import { ErrorDeNegocio } from './errores';
import { aCentesimas, formatearPorcentaje, type Redondeo } from './preferencias';

/**
 * E12 (PLAN_AMPLIACION 5.7, 6.4, 7.2 a 7.4; RB-05 a RB-10, RB-13, RB-35): la calculadora de notas. Funciones puras.
 * Notas en centésimas (0 a 500) y porcentajes en centésimas de punto (0 a 10000). Los pesos (p / N) no siempre son
 * exactos, así que todo se calcula con fracciones de enteros y solo el resultado final se redondea.
 */

// ---------- Fracciones exactas ----------

/** n / d, con d > 0 y reducida. */
export interface Fraccion {
  n: bigint;
  d: bigint;
}

const mcd = (a: bigint, b: bigint): bigint => {
  let [x, y] = [a < 0n ? -a : a, b < 0n ? -b : b];
  while (y !== 0n) [x, y] = [y, x % y];
  return x === 0n ? 1n : x;
};

export function fraccion(n: bigint | number, d: bigint | number = 1n): Fraccion {
  let [a, b] = [BigInt(n), BigInt(d)];
  if (b === 0n) throw new Error('División por cero');
  if (b < 0n) [a, b] = [-a, -b];
  const g = mcd(a, b);
  return { n: a / g, d: b / g };
}

const CERO = fraccion(0);
const UNO = fraccion(1);
const sumar = (a: Fraccion, b: Fraccion) => fraccion(a.n * b.d + b.n * a.d, a.d * b.d);
const restar = (a: Fraccion, b: Fraccion) => fraccion(a.n * b.d - b.n * a.d, a.d * b.d);
const multiplicar = (a: Fraccion, b: Fraccion) => fraccion(a.n * b.n, a.d * b.d);
const dividir = (a: Fraccion, b: Fraccion) => fraccion(a.n * b.d, a.d * b.n);
const esCero = (a: Fraccion) => a.n === 0n;
/** El entero de abajo (también con negativos). */
const piso = (a: Fraccion) => (a.n >= 0n ? a.n / a.d : -((-a.n + a.d - 1n) / a.d));

/** Para mostrar o depurar: el valor aproximado. */
export const aNumero = (a: Fraccion) => Number(a.n) / Number(a.d);

// ---------- 7.2: nota mostrada y aprobar ----------

/**
 * 7.2: la nota exacta (en centésimas) mostrada con un decimal, en décimas (0 a 50). Truncar: el decimal de abajo
 * (2,96 → 2,9). Redondear: la mitad hacia arriba (2,95 → 3,0; 2,94 → 2,9).
 */
export function mostrar(x: Fraccion | number, redondeo: Redondeo): number {
  const v = typeof x === 'number' ? fraccion(x) : x;
  const decimas = redondeo === 'truncar' ? fraccion(v.n, v.d * 10n) : fraccion(v.n + 5n * v.d, v.d * 10n);
  return Number(piso(decimas));
}

/** 7.2: aprueba si la nota mostrada es al menos la nota para aprobar (en centésimas). Nunca "3,0" que no aprueba. */
export const aprueba = (x: Fraccion | number, notaAprobar: number, redondeo: Redondeo) => mostrar(x, redondeo) * 10 >= notaAprobar;

/** Décimas → "3,7"; 50 → "5,0". */
export const formatearDecimas = (decimas: number) => `${Math.trunc(decimas / 10)},${decimas % 10}`;

/** La nota exacta mostrada como texto: "3,7". */
export const textoNota = (x: Fraccion | number, redondeo: Redondeo) => formatearDecimas(mostrar(x, redondeo));

// ---------- 7.3 y 7.4: pesos, nota actual, asegurado y estado ----------

export interface ComponenteEntrada {
  nombre: string;
  /** Centésimas, dentro de su corte. */
  porcentaje: number;
  /** Cada nota en centésimas, o null si está registrada "sin nota" (pendiente). */
  notas: ReadonlyArray<number | null>;
}

export interface CorteEntrada {
  nombre: string;
  /** Centésimas, dentro de la materia (en una materia sin cortes, el corte único de 100 %). */
  porcentaje: number;
  componentes: readonly ComponenteEntrada[];
}

export interface MateriaEntrada {
  usaCortes: boolean;
  cortes: readonly CorteEntrada[];
}

export interface Calculo {
  /** Nota actual exacta en centésimas: el promedio ponderado de lo calificado; null sin notas (RB-13). */
  actual: Fraccion | null;
  /** Lo asegurado (centésimas): lo ganado aunque lo que falta saliera 0. */
  asegurado: Fraccion;
  /** Peso calificado, como fracción de 1 (0,68 = 68 %). */
  calificado: Fraccion;
  /** Peso pendiente W = 1 − calificado (incluye los componentes sin notas). */
  pendiente: Fraccion;
  /** Los porcentajes suman 100 % y hay componentes: solo así hay estado (7.4). */
  sumasOk: boolean;
  /** W = 0 con las sumas bien: la nota actual es la definitiva. */
  definitiva: boolean;
}

const DIEZ_MIL = 10000n;

/** Suma ponderada de un corte, con el peso del corte en la materia (`pesoCorte`, fracción de 1). */
function acumularCorte(corte: CorteEntrada, pesoCorte: Fraccion) {
  let calificado = CERO;
  let puntos = CERO;
  for (const c of corte.componentes) {
    const n = c.notas.length;
    if (n === 0) continue; // 7.3: sin notas registradas, pendiente completo
    const peso = multiplicar(pesoCorte, fraccion(BigInt(c.porcentaje), DIEZ_MIL * BigInt(n))); // P × p / N
    for (const nota of c.notas) {
      if (nota === null) continue; // "sin nota": pendiente
      calificado = sumar(calificado, peso);
      puntos = sumar(puntos, multiplicar(peso, fraccion(nota)));
    }
  }
  return { calificado, puntos };
}

const sumaPorcentajes = (lista: ReadonlyArray<{ porcentaje: number }>) => lista.reduce((s, x) => s + x.porcentaje, 0);
const corteSumaBien = (corte: CorteEntrada) => corte.componentes.length > 0 && sumaPorcentajes(corte.componentes) === 10000;

function armar(calificado: Fraccion, puntos: Fraccion, sumasOk: boolean): Calculo {
  const pendiente = restar(UNO, calificado);
  const pendientePositivo = pendiente.n > 0n ? pendiente : CERO;
  return {
    actual: esCero(calificado) ? null : dividir(puntos, calificado),
    asegurado: puntos, // Σ n × w / 100 %, con los pesos ya como fracción de 1
    calificado,
    pendiente: pendientePositivo,
    sumasOk,
    definitiva: sumasOk && esCero(pendientePositivo) && !esCero(calificado),
  };
}

/** 7.4: la nota de un corte, con sus componentes (dentro del corte, el corte vale 100 %). */
export function calcularCorte(corte: CorteEntrada): Calculo {
  const { calificado, puntos } = acumularCorte(corte, UNO);
  return armar(calificado, puntos, corteSumaBien(corte));
}

/** 7.4: la materia completa. Sin cortes, el corte único vale 100 % sea cual sea su porcentaje guardado. */
export function calcularMateria(m: MateriaEntrada): Calculo {
  let calificado = CERO;
  let puntos = CERO;
  for (const corte of m.cortes) {
    const peso = m.usaCortes ? fraccion(BigInt(corte.porcentaje), DIEZ_MIL) : UNO;
    const parte = acumularCorte(corte, peso);
    calificado = sumar(calificado, parte.calificado);
    puntos = sumar(puntos, parte.puntos);
  }
  const sumasOk = m.cortes.length > 0 && (!m.usaCortes || sumaPorcentajes(m.cortes) === 10000) && m.cortes.every(corteSumaBien);
  return armar(calificado, puntos, sumasOk);
}

export type Estado = 'Aprobada' | 'Reprobada' | 'Aprueba' | 'En riesgo' | 'No alcanza';

/** 7.5: la nota máxima alcanzable (centésimas exactas): lo asegurado más 5,0 en todo lo pendiente. */
export const maximoAlcanzable = (c: Calculo) => sumar(c.asegurado, multiplicar(fraccion(500), c.pendiente));

/**
 * 7.4: con todo calificado, "Aprobada" o "Reprobada"; si falta algo, "Aprueba", "En riesgo" (aprobar aún es posible)
 * o "No alcanza". Sin estado si los porcentajes no suman 100 % o si no hay notas (RB-13).
 */
export function estadoDe(c: Calculo, notaAprobar: number, redondeo: Redondeo): Estado | null {
  if (!c.sumasOk || c.actual === null) return null;
  if (c.definitiva) return aprueba(c.actual, notaAprobar, redondeo) ? 'Aprobada' : 'Reprobada';
  if (aprueba(c.actual, notaAprobar, redondeo)) return 'Aprueba';
  return aprueba(maximoAlcanzable(c), notaAprobar, redondeo) ? 'En riesgo' : 'No alcanza';
}

// ---------- Avisos de suma (RB-07, RB-08) y RB-13 ----------

export const SIN_NOTAS = 'Aún no hay notas registradas.';
export const AYUDA_SIN_NOTA = 'Agrega también las notas que aún no tienes (sin nota) para que cuenten como pendientes.';

export const avisoCortes = (suma: number) => `Los porcentajes de los cortes suman ${formatearPorcentaje(suma)} %; deben sumar 100 %.`;
export const avisoComponentes = (suma: number, corte?: string) =>
  corte
    ? `Los porcentajes de los componentes de ${corte} suman ${formatearPorcentaje(suma)} %; deben sumar 100 %.`
    : `Los porcentajes de los componentes suman ${formatearPorcentaje(suma)} %; deben sumar 100 %.`;

/** RB-07 de la materia, o null si los cortes suman 100 % (o la materia no usa cortes). */
export function avisoDeCortes(m: MateriaEntrada): string | null {
  if (!m.usaCortes) return null;
  const suma = sumaPorcentajes(m.cortes);
  return suma === 10000 ? null : avisoCortes(suma);
}

/** RB-08 de un corte, o null si sus componentes suman 100 % o aún no tiene ninguno. */
export function avisoDeComponentes(corte: CorteEntrada, usaCortes: boolean): string | null {
  if (corte.componentes.length === 0) return null;
  const suma = sumaPorcentajes(corte.componentes);
  return suma === 10000 ? null : avisoComponentes(suma, usaCortes ? corte.nombre : undefined);
}

// ---------- Validaciones (RB-05 a RB-10) ----------

export const MAX_NOMBRE_MATERIA = 80;
export const MAX_DOCENTE = 120;
export const MAX_NOMBRE_CORTE = 40;
export const MAX_NOMBRE_COMPONENTE = 80;
export const MAX_NOMBRE_NOTA = 120;
export const MAX_CORTES_MATERIA = 6;

function texto(valor: string, max: number, codigo: 'NOMBRE_MATERIA_INVALIDO' | 'NOMBRE_CORTE_INVALIDO' | 'NOMBRE_COMPONENTE_INVALIDO'): string {
  const limpio = valor.trim().replace(/\s+/g, ' ');
  if (limpio.length < 1 || limpio.length > max) throw new ErrorDeNegocio(codigo);
  return limpio;
}

export const validarNombreMateria = (v: string) => texto(v, MAX_NOMBRE_MATERIA, 'NOMBRE_MATERIA_INVALIDO');
export const validarNombreCorte = (v: string) => texto(v, MAX_NOMBRE_CORTE, 'NOMBRE_CORTE_INVALIDO');
export const validarNombreComponente = (v: string) => texto(v, MAX_NOMBRE_COMPONENTE, 'NOMBRE_COMPONENTE_INVALIDO');

/** Docente opcional: vacío → null. */
export function validarDocente(v: string | null | undefined): string | null {
  const limpio = (v ?? '').trim().replace(/\s+/g, ' ');
  if (!limpio) return null;
  if (limpio.length > MAX_DOCENTE) throw new ErrorDeNegocio('DATOS_INVALIDOS');
  return limpio;
}

/** Nombre opcional de una nota ("Quiz 1"): vacío → null. */
export function validarNombreNota(v: string | null | undefined): string | null {
  const limpio = (v ?? '').trim().replace(/\s+/g, ' ');
  if (!limpio) return null;
  if (limpio.length > MAX_NOMBRE_NOTA) throw new ErrorDeNegocio('NOMBRE_NOTA_INVALIDO');
  return limpio;
}

/** RB-06: créditos enteros de 1 a 10. Acepta el texto del campo o un número. */
export function validarCreditos(v: string | number): number {
  const n = typeof v === 'number' ? v : /^\s*\d{1,2}\s*$/.test(v) ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new ErrorDeNegocio('CREDITOS_INVALIDOS');
  return n;
}

/** RB-09: nota de 0,0 a 5,0 con hasta dos decimales → centésimas. Vacía o null → null ("sin nota"). */
export function validarNota(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  const c = typeof v === 'number' ? v : aCentesimas(v);
  if (c === null || !Number.isInteger(c) || c < 0 || c > 500) throw new ErrorDeNegocio('NOTA_INVALIDA');
  return c;
}

/** RB-10: porcentaje mayor que 0 y hasta 100, con hasta dos decimales → centésimas. */
export function validarPorcentaje(v: string | number): number {
  const c = typeof v === 'number' ? v : aCentesimas(v);
  if (c === null || !Number.isInteger(c) || c <= 0 || c > 10000) throw new ErrorDeNegocio('PORCENTAJE_INVALIDO');
  return c;
}

// ---------- Cortes (6.4, RB-35) ----------

/** El nombre del corte único (oculto) de una materia sin cortes. */
export const NOMBRE_CORTE_UNICO = 'Corte único';
export const nombreCorte = (orden: number) => `Corte ${orden}`;

/**
 * 6.4 "Dividir en cortes": el corte único pasa a ser el Corte 1 con el primer porcentaje de la plantilla
 * (Configuración → `cortesDefecto`) y conserva sus componentes; se agregan los demás, sin componentes.
 */
export function cortesAlDividir(plantilla: readonly number[]): Array<{ orden: number; nombre: string; porcentaje: number }> {
  const lista = plantilla.length >= 2 ? plantilla : [5000, 5000];
  return lista.map((porcentaje, i) => ({ orden: i + 1, nombre: nombreCorte(i + 1), porcentaje }));
}

/** RB-35: los cortes solo se quitan cuando queda uno. */
export function puedeQuitarCortes(cantidad: number): boolean {
  return cantidad === 1;
}
