/**
 * E10g (PLAN_AMPLIACION 5.12, 7.12, 7.13, 9.7, RB-64 a RB-69): tipos de pregunta en los cuestionarios.
 * Funciones puras: reparto de mixto, puntos de cada pregunta, puntaje del intento y comparación de completar.
 */

export const TIPOS_PREGUNTA = ['unica', 'multiple', 'vf', 'completar', 'abierta'] as const;
export type TipoPregunta = (typeof TIPOS_PREGUNTA)[number];
export const TIPOS_CUESTIONARIO = [...TIPOS_PREGUNTA, 'mixto'] as const;
export type TipoCuestionario = (typeof TIPOS_CUESTIONARIO)[number];
export const TIPO_POR_DEFECTO: TipoCuestionario = 'mixto';

/** RB-64: los nombres del formulario y del historial. */
export const NOMBRE_TIPO: Record<TipoCuestionario, string> = {
  unica: 'Selección única',
  multiple: 'Respuesta múltiple',
  vf: 'Verdadero o falso',
  completar: 'Completar',
  abierta: 'Pregunta abierta',
  mixto: 'Mixto',
};

/** El orden del formulario: Mixto primero, porque es el que viene marcado. */
export const ORDEN_FORMULARIO: readonly TipoCuestionario[] = ['mixto', ...TIPOS_PREGUNTA];

export const esTipoPregunta = (v: unknown): v is TipoPregunta => typeof v === 'string' && (TIPOS_PREGUNTA as readonly string[]).includes(v);

export type Reparto = Record<TipoPregunta, number>;
const vacio = (): Reparto => ({ unica: 0, multiple: 0, vf: 0, completar: 0, abierta: 0 });

/**
 * RB-64: cuántas de cada tipo. Un tipo lleva todas las pedidas; mixto las reparte en partes iguales entre los 5
 * tipos, en su orden (5 → 1 de cada uno; 10 → 2; 20 → 4). Si no fuera exacto, el resto va a los primeros.
 */
export function repartoPorTipo(tipo: TipoCuestionario, pedidas: number): Reparto {
  const reparto = vacio();
  if (tipo !== 'mixto') {
    reparto[tipo] = pedidas;
    return reparto;
  }
  const base = Math.floor(pedidas / TIPOS_PREGUNTA.length);
  const resto = pedidas % TIPOS_PREGUNTA.length;
  TIPOS_PREGUNTA.forEach((t, i) => (reparto[t] = base + (i < resto ? 1 : 0)));
  return reparto;
}

/** 9.7: lo que falta de cada tipo después de las válidas, para la segunda llamada. */
export function faltanPorTipo(reparto: Reparto, validas: ReadonlyArray<{ tipo: TipoPregunta }>): Reparto {
  const falta = { ...reparto };
  for (const v of validas) falta[v.tipo] = Math.max(0, falta[v.tipo] - 1);
  return falta;
}

export const totalReparto = (r: Reparto) => TIPOS_PREGUNTA.reduce((s, t) => s + r[t], 0);

/** 9.7.3 (RB-64): intercala por tipo (única, múltiple, verdadero o falso, completar, abierta, única…), conservando el orden dentro de cada tipo. */
export function intercalarPorTipo<T extends { tipo: TipoPregunta }>(preguntas: readonly T[]): T[] {
  const colas = TIPOS_PREGUNTA.map((t) => preguntas.filter((p) => p.tipo === t));
  const resultado: T[] = [];
  for (let i = 0; resultado.length < preguntas.length; i++) for (const cola of colas) if (cola[i]) resultado.push(cola[i] as T);
  return resultado;
}

// ---------- 7.12: puntos de una pregunta y puntaje del intento ----------

export const AUTOEVALUACIONES = ['bien', 'medias', 'mal'] as const;
export type Autoevaluacion = (typeof AUTOEVALUACIONES)[number];
/** RB-68: los botones de la abierta. */
export const NOMBRE_AUTOEVALUACION: Record<Autoevaluacion, string> = { bien: 'La tuve bien', medias: 'A medias', mal: 'Mal' };
export const PUNTOS_AUTOEVALUACION: Record<Autoevaluacion, number> = { bien: 100, medias: 50, mal: 0 };

/** 7.12: múltiple con k correctas, b correctas marcadas y m incorrectas marcadas → max(0, trunc(100 × (b − m) / k)). */
export function puntosMultiple(correctas: readonly number[], elegidas: readonly number[]): number {
  const k = correctas.length;
  if (k === 0) return 0;
  const marcadas = new Set(elegidas);
  const b = correctas.filter((c) => marcadas.has(c)).length;
  const m = [...marcadas].filter((e) => !correctas.includes(e)).length;
  return Math.max(0, Math.trunc((100 * (b - m)) / k));
}

/** 7.12: trunc(Σ puntos × 5 / total), en centésimas de 0 a 500. En selección única da lo mismo que 7.11. */
export function puntajeIntento(puntos: readonly number[], total: number): number {
  if (total <= 0) return 0;
  return Math.trunc((puntos.reduce((s, p) => s + p, 0) * 5) / total);
}

/** 7.12: fallada es toda pregunta con menos de 100 puntos. */
export const esFallada = (puntos: number | null) => puntos !== null && puntos < 100;

/** Los puntos de una pregunta con coma y sin ceros de más: 100 → "1"; 50 → "0,5"; 66 → "0,66"; 0 → "0". */
export function formatearPuntos(centesimas: number): string {
  if (centesimas % 100 === 0) return String(centesimas / 100);
  return `${Math.trunc(centesimas / 100)},${String(centesimas % 100).padStart(2, '0').replace(/0$/, '')}`;
}

// ---------- 7.13: completar ----------

export const HUECO = '_____';
const RESPUESTA_COMPLETAR_MIN = 3;
const RESPUESTA_COMPLETAR_MAX = 40;
const RESPUESTA_COMPLETAR_PALABRAS = 4;
const SIN_TILDE: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u' };
const PUNTUACION_BORDES = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu;

/**
 * 7.13: minúsculas, sin tildes ni diéresis (la ñ se conserva), sin signos de puntuación al principio ni al final y
 * con los espacios seguidos en uno.
 */
export function normalizarRespuesta(texto: string): string {
  return texto
    .normalize('NFC')
    .toLowerCase()
    .replace(/[áéíóúüàèìòù]/g, (l) => SIN_TILDE[l] as string)
    .replace(PUNTUACION_BORDES, '')
    .replace(/\s+/g, ' ');
}

/** 7.13: "  FOTOSINTESIS " y "fotosintesis." aciertan "fotosíntesis"; "fotosíntesis y respiración" no. */
export function completarCorrecta(escrita: string, correcta: string): boolean {
  const a = normalizarRespuesta(escrita);
  return a !== '' && a === normalizarRespuesta(correcta);
}

/** 9.7.2: lo que falta tiene de 1 a 4 palabras y de 3 a 40 caracteres. */
export function respuestaCompletarValida(respuesta: string): boolean {
  const limpia = respuesta.trim().replace(/\s+/g, ' ');
  const palabras = limpia.split(' ').filter(Boolean).length;
  return limpia.length >= RESPUESTA_COMPLETAR_MIN && limpia.length <= RESPUESTA_COMPLETAR_MAX && palabras >= 1 && palabras <= RESPUESTA_COMPLETAR_PALABRAS;
}

/**
 * RB-67 (9.7.2): el servidor arma la frase con el espacio en blanco a partir de la cita, sin confiar en el modelo.
 * Busca palabras enteras seguidas de la cita que, normalizadas como en 7.13, son la respuesta, y las cambia por
 * `_____`, conservando los signos de alrededor. Null si la respuesta no aparece completa (o corta una palabra).
 */
export function armarFraseCompletar(cita: string, respuesta: string): string | null {
  if (!respuestaCompletarValida(respuesta)) return null;
  const buscada = normalizarRespuesta(respuesta);
  const k = buscada.split(' ').length;
  const palabras = cita.trim().split(/\s+/);
  for (let i = 0; i + k <= palabras.length; i++) {
    const ventana = palabras.slice(i, i + k).join(' ');
    if (normalizarRespuesta(ventana) !== buscada) continue;
    const antes = /^[\p{P}\p{S}]*/u.exec(ventana)?.[0] ?? '';
    const despues = /[\p{P}\p{S}]*$/u.exec(ventana)?.[0] ?? '';
    return [...palabras.slice(0, i), `${antes}${HUECO}${despues}`, ...palabras.slice(i + k)].join(' ');
  }
  return null;
}

// ---------- Textos de las pantallas (RB-65, RB-67, RB-68) ----------

export const textoCuantasCorrectas = (k: number) => `Hay ${k} respuestas correctas.`;
export const MENSAJE_MARCA_UNA = 'Marca al menos una opción.';
export const MENSAJE_ESCRIBE = 'Escribe tu respuesta.';
export const INDICACION_ABIERTA = 'Compara tu respuesta con la respuesta modelo y califícate.';
export const TEXTO_ABIERTA_MAX = 1000;
export const TEXTO_COMPLETAR_MAX = 200;
