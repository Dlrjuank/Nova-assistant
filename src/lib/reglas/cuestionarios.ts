import { FRAGMENTO_PALABRAS, FRAGMENTO_SOLAPAMIENTO } from '@/lib/config/nova';
import { armarFraseCompletar, esTipoPregunta, TIPOS_PREGUNTA, type TipoPregunta } from './tiposPregunta';

/** E10e (PLAN_AMPLIACION 5.11, 7.11, 9.6, RB-48 a RB-50): cuestionarios. Funciones puras. */

export const CANTIDADES = [5, 10, 20] as const;
export type Cantidad = (typeof CANTIDADES)[number];
export const DIFICULTADES = ['facil', 'media', 'dificil'] as const;
export type Dificultad = (typeof DIFICULTADES)[number];
export const NOMBRE_DIFICULTAD: Record<Dificultad, string> = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };

export const FRAGMENTOS_POR_PREGUNTA = 3; // 9.6.1: 5 → 15, 10 → 30, 20 → 60
const CITA_MIN = 20;
const CITA_MAX = 200;
const ENUNCIADO_MAX = 400;
const EXPLICACION_MAX = 400;
const OPCION_MAX = 300;
const ABIERTA_MIN = 20;
const ABIERTA_MAX = 400;

/** 9.6.2 (RB-49): al menos un fragmento por cada 2 preguntas; si no, no se llama a Gemini. */
export const minimoFragmentos = (pedidas: number) => Math.ceil(pedidas / 2);

/** RB-49: con menos de la mitad de las pedidas tras validar (y al menos 3), no se crea. */
export const minimoPreguntas = (pedidas: number) => Math.max(3, Math.ceil(pedidas / 2));

/** RB-48: un rango de páginas del PDF que existe en el documento. */
export function rangoValido(desde: number, hasta: number, paginas: number): boolean {
  return Number.isInteger(desde) && Number.isInteger(hasta) && desde >= 1 && desde <= hasta && hasta <= paginas;
}

const PASO = FRAGMENTO_PALABRAS - FRAGMENTO_SOLAPAMIENTO;

/** En qué palabra del documento empieza el fragmento n (RN-10). */
export const inicioDeFragmento = (numero: number) => (numero - 1) * PASO;

/**
 * B-60: deja de cada fragmento solo las palabras de las páginas del PDF `desde`–`hasta`, sin repetir el solapamiento.
 * Un fragmento toca páginas vecinas; sin recortarlo, el modelo puede citar texto de fuera del alcance.
 * `inicioPalabra` dice dónde empieza lo que queda, para ubicar después la página de la cita.
 */
export function recortarAPaginas<T extends { numero: number; contenido: string }>(
  fragmentos: readonly T[],
  desde: number,
  hasta: number,
  inicios: readonly number[],
): Array<T & { inicioPalabra: number }> {
  const primera = inicios[desde - 1];
  if (primera === undefined) return [];
  const fin = inicios[hasta] ?? Number.POSITIVE_INFINITY;
  const resultado: Array<T & { inicioPalabra: number }> = [];
  let cubierto = primera;
  for (const f of [...fragmentos].sort((a, b) => a.numero - b.numero)) {
    const inicio = inicioDeFragmento(f.numero);
    const palabras = f.contenido.split(' ');
    const a = Math.max(cubierto, inicio);
    const b = Math.min(fin, inicio + palabras.length);
    if (a >= b) continue;
    resultado.push({ ...f, contenido: palabras.slice(a - inicio, b - inicio).join(' '), inicioPalabra: a });
    cubierto = b;
  }
  return resultado;
}

/**
 * 9.6.1: hasta `maximo` fragmentos, repartidos de manera uniforme y, si hay varios grupos (los capítulos de un
 * libro completo), repartidos entre ellos por turnos. Conserva el orden original.
 */
export function elegirFragmentos<T extends { grupo: string | number }>(fragmentos: readonly T[], maximo: number): T[] {
  if (fragmentos.length <= maximo) return [...fragmentos];
  const grupos = new Map<string | number, number[]>();
  fragmentos.forEach((f, i) => grupos.set(f.grupo, [...(grupos.get(f.grupo) ?? []), i]));
  const lista = [...grupos.values()];
  const cupos = lista.map(() => 0);
  let quedan = maximo;
  while (quedan > 0) {
    let avanzo = false;
    for (let g = 0; g < lista.length && quedan > 0; g++) {
      if ((cupos[g] as number) < (lista[g] as number[]).length) {
        cupos[g] = (cupos[g] as number) + 1;
        quedan -= 1;
        avanzo = true;
      }
    }
    if (!avanzo) break;
  }
  const elegidos = lista.flatMap((indices, g) => {
    const k = cupos[g] as number;
    return Array.from({ length: k }, (_, i) => indices[Math.floor(((i + 0.5) * indices.length) / k)] as number);
  });
  return elegidos.sort((a, b) => a - b).map((i) => fragmentos[i] as T);
}

interface Token {
  texto: string;
  desde: number;
  hasta: number;
}

/** Palabras en minúsculas; una que termina en guion se une con la siguiente (guion de fin de línea). */
function tokens(palabras: readonly string[]): Token[] {
  const limpias = palabras.map((p) => p.normalize('NFC').replaceAll('­', '').toLowerCase());
  const resultado: Token[] = [];
  for (let i = 0; i < limpias.length; i++) {
    const p = limpias[i] as string;
    if (p === '') continue;
    const siguiente = limpias[i + 1];
    if (p.length > 1 && p.endsWith('-') && siguiente) {
      resultado.push({ texto: p.slice(0, -1) + siguiente, desde: i, hasta: i + 1 });
      i += 1;
    } else {
      resultado.push({ texto: p, desde: i, hasta: i });
    }
  }
  return resultado;
}

/**
 * RB-50: dónde aparece la cita dentro del fragmento, sin distinguir mayúsculas, espacios ni guiones de fin de
 * línea. La primera y la última palabra pueden quedar cortadas (por ejemplo, sin la coma que las sigue).
 * Devuelve las palabras del fragmento (separadas por espacios) donde empieza y termina, o null.
 */
export function ubicarCita(contenido: string, cita: string): { desde: number; hasta: number } | null {
  const texto = tokens(contenido.split(' '));
  const buscada = tokens(cita.trim().split(/\s+/));
  const k = buscada.length;
  if (k === 0) return null;
  for (let s = 0; s + k <= texto.length; s++) {
    const primero = texto[s] as Token;
    const ultimo = texto[s + k - 1] as Token;
    const bordes =
      k === 1
        ? primero.texto.includes((buscada[0] as Token).texto)
        : primero.texto.endsWith((buscada[0] as Token).texto) && ultimo.texto.startsWith((buscada[k - 1] as Token).texto);
    if (!bordes) continue;
    let medio = true;
    for (let j = 1; j < k - 1 && medio; j++) medio = (texto[s + j] as Token).texto === (buscada[j] as Token).texto;
    if (medio) return { desde: primero.desde, hasta: ultimo.hasta };
  }
  return null;
}

interface Comun {
  enunciado: string;
  explicacion: string;
  fuente: string;
  cita: string;
  desde: number;
  hasta: number;
}

/** 9.6.5 y 9.7.2: una pregunta que pasó la validación, con los campos de su tipo. En completar, el enunciado es la frase con `_____`. */
export type PreguntaValida =
  | (Comun & { tipo: 'unica'; opciones: string[]; correcta: number })
  | (Comun & { tipo: 'multiple'; opciones: string[]; correctas: number[] })
  | (Comun & { tipo: 'vf'; verdadero: boolean })
  | (Comun & { tipo: 'completar'; respuesta: string })
  | (Comun & { tipo: 'abierta'; respuesta: string });

const normal = (t: string) => t.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const esTexto = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const esPosicion = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3;
const recortar = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);

/** 4 opciones de texto, distintas entre sí. */
function cuatroOpciones(opciones: unknown): string[] | null {
  if (!Array.isArray(opciones) || opciones.length !== 4 || !opciones.every((o) => esTexto(o) && o.trim().length <= OPCION_MAX)) return null;
  const limpias = (opciones as string[]).map((o) => o.trim());
  return new Set(limpias.map(normal)).size === 4 ? limpias : null;
}

/** Los campos propios de cada tipo (9.7.2), o null si no cumplen. */
function camposDeTipo(tipo: TipoPregunta, c: Record<string, unknown>, cita: string): Record<string, unknown> | null {
  const enunciado = esTexto(c.enunciado) && c.enunciado.trim().length <= ENUNCIADO_MAX ? c.enunciado.trim() : null;
  switch (tipo) {
    case 'unica': {
      const opciones = cuatroOpciones(c.opciones);
      return enunciado && opciones && esPosicion(c.correcta) ? { enunciado, opciones, correcta: c.correcta } : null;
    }
    case 'multiple': {
      const opciones = cuatroOpciones(c.opciones);
      const correctas = c.correctas;
      if (!enunciado || !opciones || !Array.isArray(correctas) || !correctas.every(esPosicion)) return null;
      const distintas = [...new Set(correctas as number[])].sort((a, b) => a - b);
      return distintas.length === correctas.length && distintas.length >= 2 && distintas.length <= 3 ? { enunciado, opciones, correctas: distintas } : null;
    }
    case 'vf':
      return enunciado && typeof c.verdadero === 'boolean' ? { enunciado, verdadero: c.verdadero } : null;
    case 'completar': {
      if (!esTexto(c.respuesta)) return null;
      const respuesta = c.respuesta.trim().replace(/\s+/g, ' ');
      const frase = armarFraseCompletar(cita, respuesta); // RB-67: la arma el servidor, no el modelo
      return frase ? { enunciado: frase, respuesta } : null;
    }
    case 'abierta': {
      if (!enunciado || !esTexto(c.respuesta)) return null;
      const respuesta = c.respuesta.trim();
      return respuesta.length >= ABIERTA_MIN && respuesta.length <= ABIERTA_MAX ? { enunciado, respuesta } : null;
    }
  }
}

/**
 * 9.6.5 y 9.7.2 (RB-50): descarta lo que no cumple: etiqueta que no se entregó, cita de 20 a 200 caracteres que no
 * está en ese fragmento, enunciado repetido o campos de su tipo que no cumplen. `cupos` dice cuántas faltan de
 * cada tipo: una de un tipo que no se pidió, o de uno ya completo, se descarta. Sin `cupos`, todas de selección
 * única. Si el modelo no dice el tipo y se pidió uno solo, es ese.
 */
export function validarPreguntas(
  crudas: unknown,
  fragmentos: ReadonlyMap<string, { contenido: string }>,
  enunciadosPrevios: readonly string[] = [],
  cupos: Partial<Record<TipoPregunta, number>> = { unica: Number.POSITIVE_INFINITY },
): PreguntaValida[] {
  if (!Array.isArray(crudas)) return [];
  const quedan = { ...cupos };
  const pedidos = TIPOS_PREGUNTA.filter((t) => (cupos[t] ?? 0) > 0);
  const vistos = new Set(enunciadosPrevios.map(normal));
  const validas: PreguntaValida[] = [];
  for (const c of crudas as Array<Record<string, unknown>>) {
    if (!c || typeof c !== 'object') continue;
    const tipo = esTipoPregunta(c.tipo) ? c.tipo : c.tipo === undefined && pedidos.length === 1 ? pedidos[0] : undefined;
    if (!tipo || (quedan[tipo] ?? 0) <= 0) continue;
    const { explicacion, fuente, cita_textual: cita } = c;
    if (!esTexto(fuente) || !esTexto(cita) || !esTexto(explicacion)) continue;
    const fragmento = fragmentos.get(fuente.trim());
    const citaLimpia = cita.trim();
    if (!fragmento || citaLimpia.length < CITA_MIN || citaLimpia.length > CITA_MAX) continue;
    const lugar = ubicarCita(fragmento.contenido, citaLimpia);
    if (!lugar) continue;
    const campos = camposDeTipo(tipo, c, citaLimpia);
    if (!campos || vistos.has(normal(campos.enunciado as string))) continue;
    vistos.add(normal(campos.enunciado as string));
    quedan[tipo] = (quedan[tipo] ?? 0) - 1;
    validas.push({ tipo, ...campos, explicacion: recortar(explicacion.trim(), EXPLICACION_MAX), fuente: fuente.trim(), cita: citaLimpia, ...lugar } as PreguntaValida);
  }
  return validas;
}

/** 9.6.6: baraja las opciones y conserva cuál es la correcta. `aleatorio` se inyecta en las pruebas. */
export function barajarOpciones(opciones: readonly string[], correcta: number, aleatorio: () => number = Math.random): { opciones: string[]; correcta: number } {
  const { opciones: barajadas, correctas } = barajarMultiple(opciones, [correcta], aleatorio);
  return { opciones: barajadas, correcta: correctas[0] as number };
}

/** 9.7.3: baraja las opciones de una múltiple y conserva cuáles son correctas (ordenadas). */
export function barajarMultiple(opciones: readonly string[], correctas: readonly number[], aleatorio: () => number = Math.random): { opciones: string[]; correctas: number[] } {
  const orden = opciones.map((_, i) => i);
  for (let i = orden.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [orden[i], orden[j]] = [orden[j] as number, orden[i] as number];
  }
  return { opciones: orden.map((i) => opciones[i] as string), correctas: correctas.map((c) => orden.indexOf(c)).sort((a, b) => a - b) };
}

/**
 * 9.6.6: la página impresa donde está la cita, con dónde empieza cada página del PDF (`inicios`, M20) y la
 * diferencia entre la página impresa y la del PDF que da el propio fragmento. Null si no se puede saber.
 */
export function etiquetaDeCita(
  fragmento: { inicioPalabra: number; pagina_inicio: number | null; etiqueta_paginas: string | null },
  lugar: { desde: number; hasta: number },
  inicios: readonly number[] | null | undefined,
): string | null {
  if (!inicios?.length || fragmento.pagina_inicio === null || !fragmento.etiqueta_paginas) return null;
  const impresa = /^\d+/.exec(fragmento.etiqueta_paginas)?.[0];
  if (impresa === undefined) return null;
  const paginaPdf = (palabra: number) => {
    let pagina = 1;
    while (pagina < inicios.length && (inicios[pagina] as number) <= palabra) pagina += 1;
    return pagina;
  };
  const base = fragmento.inicioPalabra;
  const diferencia = Number(impresa) - fragmento.pagina_inicio;
  const a = paginaPdf(base + lugar.desde) + diferencia;
  const b = paginaPdf(base + lugar.hasta) + diferencia;
  return a === b ? String(a) : `${a}–${b}`;
}

/** 7.11: aciertos × 500 / total, en centésimas y truncado. Con tipos, `puntajeIntento` (7.12) da lo mismo en selección única. */
export function calcularPuntaje(aciertos: number, total: number): number {
  return total > 0 ? Math.trunc((aciertos * 500) / total) : 0;
}

/** 7.11: un decimal truncado, con coma (350 → "3,5"; 333 → "3,3"; 500 → "5,0"). */
export function formatearPuntaje(centesimas: number): string {
  return `${Math.trunc(centesimas / 100)},${Math.trunc((centesimas % 100) / 10)}`;
}

/** "Todo el documento", el título del capítulo o "Páginas 2–4". */
export function textoAlcance(alcance: 'documento' | 'capitulo' | 'paginas', capitulo: string | null, desde: number | null, hasta: number | null): string {
  if (alcance === 'capitulo') return capitulo ?? 'Un capítulo';
  if (alcance === 'paginas') return desde === hasta ? `Página ${desde}` : `Páginas ${desde}–${hasta}`;
  return 'Todo el documento';
}
