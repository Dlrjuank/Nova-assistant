import { ErrorDeNegocio } from './errores';
import { esFechaISOValida, semanaDe } from './fechas';

/**
 * E18 (PLAN_AMPLIACION 6.9, 9.2 a 9.4; RB-20, RB-22, RB-23): reglas puras del plan de estudio de un corte.
 * El contenido guardado sigue el esquema de 9.3 (semanas → días → pasos). El modelo no arma las semanas ni pone
 * los ids: devuelve días con pasos, cita los temas y los fragmentos con etiquetas cortas ("T1", "F2"), y el
 * servidor valida todo, pone los ids y agrupa por semana (de lunes a domingo, 7.1).
 */

export const MAX_TITULO_PASO = 120;
export const MIN_MINUTOS_PASO = 15;
export const MAX_MINUTOS_PASO = 240;
export const MAX_PASOS_PLAN = 60;
/** 9.2: como mucho estos temas confirmados van al modelo (los demás, por nombre, quedan fuera). */
export const MAX_TEMAS_PLAN = 20;
/** 9.2: por cada tema, los 2 fragmentos más parecidos entre los PDF de la materia. */
export const FRAGMENTOS_POR_TEMA = 2;

export type OrigenVersion = 'asistente' | 'manual' | 'restaurada';

export interface PasoPlan {
  id: string;
  titulo: string;
  tema_id: string;
  minutos: number;
  /** Etiquetas legibles de los fragmentos citados ("syllabus.pdf · p. 2"). Un paso manual no cita nada. */
  fuentes: string[];
}
export interface DiaPlan {
  fecha: string;
  pasos: PasoPlan[];
}
export interface SemanaPlan {
  /** El lunes de la semana. */
  inicio: string;
  dias: DiaPlan[];
}
export interface ContenidoPlan {
  semanas: SemanaPlan[];
}

/** Un paso con su fecha, para editar y validar sin semanas ni días. */
export interface PasoConFecha extends PasoPlan {
  fecha: string;
}

/** Los pasos en orden (por fecha y, dentro del día, como estaban). */
export function pasosDe(contenido: ContenidoPlan): PasoConFecha[] {
  return contenido.semanas.flatMap((s) => s.dias.flatMap((d) => d.pasos.map((p) => ({ ...p, fecha: d.fecha }))));
}

/** Agrupa los pasos por día y por semana (lunes a domingo), en orden de fecha. */
export function armarSemanas(pasos: readonly PasoConFecha[]): ContenidoPlan {
  const ordenados = [...pasos].map((p, i) => ({ p, i })).sort((a, b) => (a.p.fecha === b.p.fecha ? a.i - b.i : a.p.fecha < b.p.fecha ? -1 : 1));
  const semanas: SemanaPlan[] = [];
  for (const { p } of ordenados) {
    const inicio = semanaDe(p.fecha).lunes;
    let semana = semanas[semanas.length - 1];
    if (!semana || semana.inicio !== inicio) {
      semana = { inicio, dias: [] };
      semanas.push(semana);
    }
    let dia = semana.dias[semana.dias.length - 1];
    if (!dia || dia.fecha !== p.fecha) {
      dia = { fecha: p.fecha, pasos: [] };
      semana.dias.push(dia);
    }
    dia.pasos.push({ id: p.id, titulo: p.titulo, tema_id: p.tema_id, minutos: p.minutos, fuentes: p.fuentes });
  }
  return { semanas };
}

/** Total de minutos de un plan. */
export const minutosDe = (contenido: ContenidoPlan) => pasosDe(contenido).reduce((s, p) => s + p.minutos, 0);

const limpiarTitulo = (v: string) => v.trim().replace(/\s+/g, ' ');
const tituloValido = (t: string) => t.length >= 1 && t.length <= MAX_TITULO_PASO;
const minutosValidos = (m: unknown): m is number => typeof m === 'number' && Number.isInteger(m) && m >= MIN_MINUTOS_PASO && m <= MAX_MINUTOS_PASO;
const fechaEnRango = (f: unknown, hoy: string, fechaCorte: string): f is string => typeof f === 'string' && esFechaISOValida(f) && f >= hoy && f <= fechaCorte;

export interface ContextoGenerado {
  /** "T1" → id del tema confirmado. */
  temas: ReadonlyMap<string, string>;
  /** "F1" → etiqueta legible del fragmento entregado. */
  etiquetas: ReadonlyMap<string, string>;
  hoy: string;
  fechaCorte: string;
  nuevoId: () => string;
}

/** Por qué se rechazó (para el registro del servidor; al usuario solo le llega RB-22). */
export type ResultadoValidacion = { ok: true; contenido: ContenidoPlan } | { ok: false; motivo: string };

/**
 * 9.3 y RB-22: el plan del modelo se acepta entero o se rechaza entero. Se rechaza si no cumple el esquema (título
 * de 1 a 120, minutos de 15 a 240), si un paso usa un tema que no es un confirmado entregado, si cita una fuente
 * que no se entregó, si una fecha queda fuera de [hoy, fecha del corte], si no tiene pasos o si pasa de 60.
 */
export function validarPlanGenerado(crudo: unknown, ctx: ContextoGenerado): ResultadoValidacion {
  const dias = (crudo as { dias?: unknown } | null)?.dias;
  if (!Array.isArray(dias)) return { ok: false, motivo: 'sin días' };
  const pasos: PasoConFecha[] = [];
  for (const d of dias) {
    const { fecha, pasos: crudos } = (d ?? {}) as { fecha?: unknown; pasos?: unknown };
    if (!fechaEnRango(fecha, ctx.hoy, ctx.fechaCorte)) return { ok: false, motivo: `fecha fuera de rango: ${String(fecha)}` };
    if (!Array.isArray(crudos)) return { ok: false, motivo: 'día sin pasos' };
    for (const c of crudos) {
      const { titulo, tema, minutos, fuentes } = (c ?? {}) as { titulo?: unknown; tema?: unknown; minutos?: unknown; fuentes?: unknown };
      if (typeof titulo !== 'string' || !tituloValido(limpiarTitulo(titulo))) return { ok: false, motivo: 'título inválido' };
      const temaId = typeof tema === 'string' ? ctx.temas.get(tema.trim()) : undefined;
      if (!temaId) return { ok: false, motivo: `tema no confirmado: ${String(tema)}` };
      if (!minutosValidos(minutos)) return { ok: false, motivo: `minutos inválidos: ${String(minutos)}` };
      if (!Array.isArray(fuentes)) return { ok: false, motivo: 'fuentes inválidas' };
      const legibles: string[] = [];
      for (const f of fuentes) {
        const legible = typeof f === 'string' ? ctx.etiquetas.get(f.trim()) : undefined;
        if (!legible) return { ok: false, motivo: `fuente inventada: ${String(f)}` };
        if (!legibles.includes(legible)) legibles.push(legible);
      }
      pasos.push({ id: ctx.nuevoId(), fecha, titulo: limpiarTitulo(titulo), tema_id: temaId, minutos, fuentes: legibles });
    }
  }
  if (pasos.length === 0) return { ok: false, motivo: 'sin pasos' };
  if (pasos.length > MAX_PASOS_PLAN) return { ok: false, motivo: `${pasos.length} pasos` };
  return { ok: true, contenido: armarSemanas(pasos) };
}

/** Un paso como lo manda la pantalla al editar: sin `id` es un paso nuevo. */
export interface PasoEditado {
  id?: string | undefined;
  titulo: string;
  fecha: string;
  minutos: number | string;
  temaId: string;
}

export interface ContextoManual {
  /** Los pasos de la versión vigente (de ahí salen las fuentes y lo que no cambió). */
  anteriores: readonly PasoConFecha[];
  /** Ids de los temas confirmados del corte. */
  temasConfirmados: ReadonlySet<string>;
  hoy: string;
  fechaCorte: string | null;
  nuevoId: () => string;
}

/**
 * 9.4 "Editar": cambia título, fecha y minutos, borra pasos (los que no llegan) y agrega pasos con un tema
 * confirmado. Una fecha nueva o cambiada va de hoy a la fecha del corte; la de un paso que no se movió se respeta
 * aunque ya pasó. Un tema nuevo o cambiado debe estar confirmado. Las fuentes de cada paso se conservan; los
 * nuevos no citan nada.
 */
export function validarPlanManual(entrada: readonly PasoEditado[], ctx: ContextoManual): ContenidoPlan {
  if (entrada.length === 0) throw new ErrorDeNegocio('PLAN_SIN_PASOS');
  if (entrada.length > MAX_PASOS_PLAN) throw new ErrorDeNegocio('PLAN_MUY_LARGO');
  const anteriores = new Map(ctx.anteriores.map((p) => [p.id, p]));
  const vistos = new Set<string>();
  const pasos = entrada.map((e): PasoConFecha => {
    const anterior = e.id === undefined ? undefined : anteriores.get(e.id);
    if (e.id !== undefined && (!anterior || vistos.has(e.id))) throw new ErrorDeNegocio('DATOS_INVALIDOS');
    if (e.id !== undefined) vistos.add(e.id);
    const titulo = limpiarTitulo(String(e.titulo ?? ''));
    if (!tituloValido(titulo)) throw new ErrorDeNegocio('PASO_TITULO_INVALIDO');
    const minutos = typeof e.minutos === 'string' && /^\d+$/.test(e.minutos.trim()) ? Number(e.minutos.trim()) : e.minutos;
    if (!minutosValidos(minutos)) throw new ErrorDeNegocio('PASO_MINUTOS_INVALIDOS');
    const fecha = String(e.fecha ?? '').trim();
    const fechaIgual = anterior !== undefined && anterior.fecha === fecha;
    if (!fechaIgual && (ctx.fechaCorte === null || !fechaEnRango(fecha, ctx.hoy, ctx.fechaCorte))) throw new ErrorDeNegocio('PASO_FECHA_INVALIDA');
    const temaIgual = anterior !== undefined && anterior.tema_id === e.temaId;
    if (!temaIgual && !ctx.temasConfirmados.has(e.temaId)) throw new ErrorDeNegocio('PASO_TEMA_INVALIDO');
    return { id: anterior?.id ?? ctx.nuevoId(), fecha, titulo, tema_id: e.temaId, minutos, fuentes: anterior?.fuentes ?? [] };
  });
  return armarSemanas(pasos);
}

// ---------- 9.4: huella y aviso de cambios (RB-23) ----------

export interface Huella {
  /** La meta del corte (o de la materia sin cortes), en centésimas. */
  meta: number | null;
  temas: Array<{ id: string; nombre: string }>;
  /** Las notas de la materia (id y valor en centésimas). */
  notas: Array<{ id: string; nota: number | null }>;
  /** Los PDF indexados de la materia. */
  documentos: string[];
}

/** La huella en un orden fijo, para guardarla y compararla. */
export function normalizarHuella(h: Huella): Huella {
  return {
    meta: h.meta,
    temas: [...h.temas].sort((a, b) => (a.id < b.id ? -1 : 1)),
    notas: [...h.notas].sort((a, b) => (a.id < b.id ? -1 : 1)),
    documentos: [...h.documentos].sort(),
  };
}

/** Lee una huella guardada sin confiar en su forma (una vacía no rompe la pantalla). */
function leerHuella(v: unknown): Huella {
  const h = (v ?? {}) as Partial<Huella>;
  return normalizarHuella({
    meta: typeof h.meta === 'number' ? h.meta : null,
    temas: Array.isArray(h.temas) ? h.temas : [],
    notas: Array.isArray(h.notas) ? h.notas : [],
    documentos: Array.isArray(h.documentos) ? h.documentos : [],
  });
}

const contar = (n: number, uno: string, varios: string) => (n === 1 ? uno : `${n} ${varios}`);

/** RB-23: qué cambió entre la huella de la versión vigente y la de ahora ("un PDF nuevo", "notas nuevas"…). */
export function cambiosHuella(guardada: unknown, actual: Huella): string[] {
  const antes = leerHuella(guardada);
  const ahora = normalizarHuella(actual);
  const cambios: string[] = [];
  const docsAntes = new Set(antes.documentos);
  const docsAhora = new Set(ahora.documentos);
  const nuevos = ahora.documentos.filter((d) => !docsAntes.has(d)).length;
  const quitados = antes.documentos.filter((d) => !docsAhora.has(d)).length;
  if (nuevos > 0) cambios.push(contar(nuevos, 'un PDF nuevo', 'PDF nuevos'));
  if (quitados > 0) cambios.push(contar(quitados, 'un PDF eliminado', 'PDF eliminados'));
  const notasAntes = new Map(antes.notas.map((n) => [n.id, n.nota]));
  const hayNuevas = ahora.notas.some((n) => !notasAntes.has(n.id) || (notasAntes.get(n.id) === null && n.nota !== null));
  if (hayNuevas) cambios.push('notas nuevas');
  else if (JSON.stringify(antes.notas) !== JSON.stringify(ahora.notas)) cambios.push('notas cambiadas');
  if (JSON.stringify(antes.temas) !== JSON.stringify(ahora.temas)) cambios.push('temas cambiados');
  if (antes.meta !== ahora.meta) cambios.push('meta cambiada');
  return cambios;
}

/** "a", "a y b", "a, b y c". */
export function unirLista(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/** RB-23: `Hay cambios desde la última versión del plan: {lista}. ¿Quieres actualizarlo?` */
export const textoCambiosPlan = (cambios: readonly string[]) => `Hay cambios desde la última versión del plan: ${unirLista(cambios)}. ¿Quieres actualizarlo?`;

/** RB-19 para el plan, con el texto de una materia sin cortes. */
export const textoSinFechaPlan = (usaCortes: boolean) =>
  usaCortes ? 'Pon una fecha futura al corte para generar el plan.' : 'Pon una fecha final futura a la materia para generar el plan.';

/** Cómo nació una versión: "del asistente", "editada a mano" o "restaurada". */
export function textoOrigen(origen: OrigenVersion): string {
  return origen === 'asistente' ? 'del asistente' : origen === 'manual' ? 'editada a mano' : 'restaurada';
}

/** "1 h 30 min", "45 min", "2 h". */
export function textoMinutos(m: number): string {
  const h = Math.floor(m / 60);
  const resto = m % 60;
  if (h === 0) return `${resto} min`;
  return resto === 0 ? `${h} h` : `${h} h ${resto} min`;
}

const fechaUTC = (fecha: string) => {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(anio, mes - 1, dia));
};

/** "martes, 17 de noviembre" (la fecha ya está en Bogotá). */
export const textoDia = (fecha: string) => new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(fechaUTC(fecha));

/** "Semana del 16 de noviembre". */
export const textoSemana = (lunes: string) => `Semana del ${new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(fechaUTC(lunes))}`;
