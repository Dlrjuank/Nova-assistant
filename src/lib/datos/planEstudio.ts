import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { aLiteralVector, conTransaccion, consultar } from '@/lib/db/conexion';
import { llm } from '@/lib/llm/gemini';
import { consultaTemaPlan, ESQUEMA_PLAN, pedidoPlan, SYSTEM_PROMPT_PLAN } from '@/lib/llm/planEstudio';
import { etiquetaFragmento } from '@/lib/llm/prompts';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { hoyBogota } from '@/lib/reglas/fechas';
import { alcanzable, calcularCorte, calcularMateria, formatearDecimas, mostrar, type MateriaEntrada } from '@/lib/reglas/notas';
import {
  cambiosHuella,
  FRAGMENTOS_POR_TEMA,
  MAX_TEMAS_PLAN,
  normalizarHuella,
  pasosDe,
  textoSinFechaPlan,
  validarPlanGenerado,
  validarPlanManual,
  type ContenidoPlan,
  type Huella,
  type OrigenVersion,
  type PasoEditado,
} from '@/lib/reglas/planEstudio';
import { corteConFechaFutura } from '@/lib/reglas/temas';
import { obtenerPreferencias } from './configuracion';
import { listarMaterias, listarMetasNota, type Materia } from './semestre';
import type { Fragmento } from './tipos';

/** E18 (6.9, 9.2 a 9.4): una versión del plan de un corte. */
export interface VersionPlan {
  numero: number;
  origen: OrigenVersion;
  creadaEn: string;
  contenido: ContenidoPlan;
}

export interface ResumenVersion {
  numero: number;
  origen: OrigenVersion;
  creadaEn: string;
  pasos: number;
}

/** El plan de un corte: la versión vigente (o la pedida), la lista de versiones y el aviso RB-23. */
export interface PlanCorte {
  planId: string;
  corteId: string;
  vigente: number;
  /** La versión que se muestra: la vigente, salvo que se pida otra para verla. */
  version: VersionPlan;
  versiones: ResumenVersion[];
  /** RB-23: lo que cambió desde la vigente ("un PDF nuevo"…); vacío si nada. */
  cambios: string[];
  /** E19 (9.5): paso → tarea, para los pasos ya pasados a Tareas. */
  enTareas: Record<string, string>;
}

interface DatosCorte {
  id: string;
  nombre: string;
  fecha: string | null;
  materia: Materia;
}

/** El corte del usuario con su materia completa (cortes, componentes y notas). */
async function cargarCorte(usuarioId: string, corteId: string): Promise<DatosCorte> {
  const [fila] = await consultar<{ materia_id: string }>('SELECT materia_id FROM cortes WHERE id = $1 AND usuario_id = $2', [corteId, usuarioId]);
  const materia = fila ? (await listarMaterias(usuarioId, fila.materia_id))[0] : undefined;
  const corte = materia?.cortes.find((c) => c.id === corteId);
  if (!materia || !corte) throw new ErrorDeNegocio('CORTE_NO_ENCONTRADO');
  return { id: corte.id, nombre: corte.nombre, fecha: corte.fecha, materia };
}

const entradaDe = (m: Materia): MateriaEntrada => ({
  usaCortes: m.usaCortes,
  cortes: m.cortes.map((c) => ({
    nombre: c.nombre,
    porcentaje: c.porcentaje,
    componentes: c.componentes.map((k) => ({ nombre: k.nombre, porcentaje: k.porcentaje, notas: k.notas.map((n) => n.nota) })),
  })),
});

async function temasConfirmados(usuarioId: string, corteId: string): Promise<Array<{ id: string; nombre: string }>> {
  return consultar("SELECT id, nombre FROM temas WHERE corte_id = $1 AND usuario_id = $2 AND estado = 'confirmado' ORDER BY lower(nombre)", [corteId, usuarioId]);
}

async function documentosIndexados(usuarioId: string, materiaId: string): Promise<string[]> {
  const filas = await consultar<{ id: string }>('SELECT id FROM documentos WHERE usuario_id = $1 AND materia_id = $2 AND progreso IS NULL', [usuarioId, materiaId]);
  return filas.map((f) => f.id);
}

/** La meta que cuenta para el corte: la del corte o, en una materia sin cortes, la de la materia. */
async function metaDelCorte(usuarioId: string, d: DatosCorte): Promise<number | null> {
  const metas = await listarMetasNota(usuarioId, d.materia.id);
  return metas.find((m) => m.corteId === (d.materia.usaCortes ? d.id : null))?.meta ?? null;
}

/** 9.4: la huella de ahora (meta, temas confirmados, notas de la materia y PDF indexados). */
async function huellaActual(usuarioId: string, d: DatosCorte): Promise<Huella> {
  const [meta, temas, documentos] = await Promise.all([metaDelCorte(usuarioId, d), temasConfirmados(usuarioId, d.id), documentosIndexados(usuarioId, d.materia.id)]);
  const notas = d.materia.cortes.flatMap((c) => c.componentes.flatMap((k) => k.notas.map((n) => ({ id: n.id, nota: n.nota }))));
  return normalizarHuella({ meta, temas, notas, documentos });
}

interface FilaVersion {
  plan_id: string;
  numero: number;
  origen: OrigenVersion;
  creada_en: string;
  contenido: ContenidoPlan;
  huella: unknown;
}

const COLUMNAS_VERSION = `v.plan_id, v.numero, v.origen, to_char(v.creada_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI') AS creada_en, v.contenido, v.huella`;

const aVersion = (f: FilaVersion): VersionPlan => ({ numero: f.numero, origen: f.origen, creadaEn: f.creada_en, contenido: f.contenido });

/**
 * El plan de un corte, o null si aún no tiene. Con `numero`, muestra esa versión (para verla o restaurarla); el
 * aviso RB-23 siempre compara la vigente con lo de ahora.
 */
export async function obtenerPlan(usuarioId: string, corteId: string, numero?: number | undefined): Promise<PlanCorte | null> {
  const d = await cargarCorte(usuarioId, corteId);
  const [plan] = await consultar<{ id: string }>('SELECT id FROM planes_estudio WHERE corte_id = $1 AND usuario_id = $2', [corteId, usuarioId]);
  if (!plan) return null;
  return armarPlan(usuarioId, d, plan.id, numero);
}

async function armarPlan(usuarioId: string, d: DatosCorte, planId: string, numero?: number | undefined): Promise<PlanCorte> {
  const versiones = await consultar<FilaVersion>(`SELECT ${COLUMNAS_VERSION} FROM versiones_plan v WHERE v.plan_id = $1 AND v.usuario_id = $2 ORDER BY v.numero DESC`, [planId, usuarioId]);
  const vigente = versiones[0];
  if (!vigente) throw new ErrorDeNegocio('PLAN_NO_ENCONTRADO');
  const vista = numero === undefined ? vigente : versiones.find((v) => v.numero === numero);
  if (!vista) throw new ErrorDeNegocio('VERSION_NO_ENCONTRADA');
  const [huella, enTareas] = await Promise.all([
    huellaActual(usuarioId, d),
    consultar<{ paso_id: string; tarea_id: string }>('SELECT paso_id, tarea_id FROM pasos_en_tareas WHERE plan_id = $1 AND usuario_id = $2', [planId, usuarioId]),
  ]);
  return {
    planId,
    corteId: d.id,
    vigente: vigente.numero,
    version: aVersion(vista),
    versiones: versiones.map((v) => ({ numero: v.numero, origen: v.origen, creadaEn: v.creada_en, pasos: pasosDe(v.contenido).length })),
    cambios: cambiosHuella(vigente.huella, huella),
    enTareas: Object.fromEntries(enTareas.map((e) => [e.paso_id, e.tarea_id])),
  };
}

/** Los planes de los cortes de una materia (para "Objetivos y plan"), por corte. */
export async function planesDeMateria(usuarioId: string, materiaId: string): Promise<Record<string, PlanCorte>> {
  const planes = await consultar<{ id: string; corte_id: string }>(
    'SELECT p.id, p.corte_id FROM planes_estudio p JOIN cortes c ON c.id = p.corte_id WHERE p.usuario_id = $1 AND c.materia_id = $2',
    [usuarioId, materiaId],
  );
  if (planes.length === 0) return {};
  const [materia] = await listarMaterias(usuarioId, materiaId);
  if (!materia) return {};
  const resultado: Record<string, PlanCorte> = {};
  for (const p of planes) {
    const corte = materia.cortes.find((c) => c.id === p.corte_id);
    if (!corte) continue;
    resultado[p.corte_id] = await armarPlan(usuarioId, { id: corte.id, nombre: corte.nombre, fecha: corte.fecha, materia }, p.id);
  }
  return resultado;
}

/** Los fragmentos más parecidos de los PDF de una materia (9.2), sin el índice HNSW (filtro estrecho, como en E10c). */
async function fragmentosDeMateria(usuarioId: string, vector: number[], limite: number, materiaId: string): Promise<Fragmento[]> {
  return consultar<Fragmento>(
    `SELECT f.id, f.documento_id, f.numero, f.contenido, d.nombre_archivo, (f.vector <=> $1::vector)::float AS distancia, f.etiqueta_paginas
     FROM fragmentos_pdf f JOIN documentos d ON d.id = f.documento_id
     WHERE d.materia_id = $3 AND d.usuario_id = $4 AND d.progreso IS NULL
     ORDER BY (f.vector <=> $1::vector) + 0
     LIMIT $2`,
    [aLiteralVector(vector), limite, materiaId, usuarioId],
  );
}

/** "Meta: 4,0 · Alcanzable: necesitas 3,8 en lo que falta." y la nota actual, para el modelo. */
async function textosDeNotas(usuarioId: string, d: DatosCorte, meta: number | null): Promise<{ meta: string | null; notas: string }> {
  const { redondeo } = await obtenerPreferencias(usuarioId);
  const entrada = entradaDe(d.materia);
  const i = d.materia.cortes.findIndex((c) => c.id === d.id);
  const calculo = d.materia.usaCortes ? calcularCorte(entrada.cortes[i] as MateriaEntrada['cortes'][number]) : calcularMateria(entrada);
  const donde = d.materia.usaCortes ? 'del corte' : 'de la materia';
  const porcentaje = Math.round((Number(calculo.calificado.n) / Number(calculo.calificado.d)) * 100);
  const notas = calculo.actual === null ? `Aún no hay notas ${donde}.` : `Nota actual ${donde}: ${formatearDecimas(mostrar(calculo.actual, redondeo))} con el ${porcentaje} % calificado.`;
  if (meta === null) return { meta: null, notas };
  return { meta: `Meta ${donde}: ${formatearDecimas(Math.ceil(meta / 10))} · ${alcanzable(calculo, meta, redondeo).texto}`, notas };
}

/** Bloquea el plan del corte (lo crea si no existe) y devuelve su id y el número de la versión vigente. */
async function bloquearPlan(tx: PoolClient, usuarioId: string, corteId: string): Promise<{ planId: string; ultimo: number }> {
  await tx.query('INSERT INTO planes_estudio (usuario_id, corte_id) VALUES ($1, $2) ON CONFLICT (corte_id) DO NOTHING', [usuarioId, corteId]);
  const plan = (await tx.query<{ id: string }>('SELECT id FROM planes_estudio WHERE corte_id = $1 AND usuario_id = $2 FOR UPDATE', [corteId, usuarioId])).rows[0];
  if (!plan) throw new ErrorDeNegocio('CORTE_NO_ENCONTRADO');
  const ultimo = (await tx.query<{ n: number }>('SELECT COALESCE(MAX(numero), 0)::int AS n FROM versiones_plan WHERE plan_id = $1', [plan.id])).rows[0]?.n ?? 0;
  return { planId: plan.id, ultimo };
}

async function insertarVersion(tx: PoolClient, planId: string, usuarioId: string, numero: number, origen: OrigenVersion, contenido: ContenidoPlan, huella: unknown) {
  await tx.query('INSERT INTO versiones_plan (plan_id, usuario_id, numero, origen, contenido, huella) VALUES ($1, $2, $3, $4, $5, $6)', [
    planId,
    usuarioId,
    numero,
    origen,
    JSON.stringify(contenido),
    JSON.stringify(huella),
  ]);
}

/**
 * 9.2 y 9.3: genera una versión nueva del plan con el asistente. RB-19 y RB-20 se revisan antes de gastar cuota.
 * Los fragmentos: 1 pedido de embeddings con todos los temas y 2 fragmentos por tema entre los PDF de la materia.
 * Un plan que no pasa la validación se pide otra vez; si vuelve a fallar, PLAN_INVALIDO (RB-22).
 */
export async function generarPlan(usuarioId: string, corteId: string, hoy: string = hoyBogota()): Promise<PlanCorte> {
  const d = await cargarCorte(usuarioId, corteId);
  if (!d.fecha || !corteConFechaFutura(d.fecha, hoy)) throw new ErrorDeNegocio('PLAN_SIN_FECHA', textoSinFechaPlan(d.materia.usaCortes));
  const fechaCorte = d.fecha;
  const temas = (await temasConfirmados(usuarioId, corteId)).slice(0, MAX_TEMAS_PLAN);
  if (temas.length === 0) throw new ErrorDeNegocio('SIN_TEMAS_CONFIRMADOS'); // RB-20

  const documentos = await documentosIndexados(usuarioId, d.materia.id);
  const fragmentos: Fragmento[] = [];
  if (documentos.length > 0) {
    const vectores = await llm.generarEmbeddings(
      temas.map((t) => consultaTemaPlan(t.nombre)),
      { interactivo: true },
    );
    const vistos = new Set<string>();
    for (const vector of vectores) {
      for (const f of await fragmentosDeMateria(usuarioId, vector, FRAGMENTOS_POR_TEMA, d.materia.id)) {
        if (vistos.has(f.id)) continue;
        vistos.add(f.id);
        fragmentos.push(f);
      }
    }
  }
  const meta = await metaDelCorte(usuarioId, d);
  const textos = await textosDeNotas(usuarioId, d, meta);
  const contenidoPedido = pedidoPlan({
    materia: d.materia.nombre,
    corte: d.materia.usaCortes ? d.nombre : null,
    hoy,
    fechaCorte,
    meta: textos.meta,
    notas: textos.notas,
    temas: temas.map((t, i) => ({ etiqueta: `T${i + 1}`, nombre: t.nombre })),
    fragmentos: fragmentos.map((f, i) => ({ etiqueta: `F${i + 1}`, contenido: f.contenido })),
  });
  const contexto = {
    temas: new Map(temas.map((t, i) => [`T${i + 1}`, t.id])),
    etiquetas: new Map(fragmentos.map((f, i) => [`F${i + 1}`, etiquetaFragmento(f)])),
    hoy,
    fechaCorte,
    nuevoId: randomUUID,
  };

  let contenido: ContenidoPlan | null = null;
  for (let intento = 1; intento <= 2 && !contenido; intento++) {
    let crudo: unknown;
    try {
      crudo = await llm.generarJson({ sistema: SYSTEM_PROMPT_PLAN, contenido: contenidoPedido, esquema: ESQUEMA_PLAN, tiempoMaximoMs: 50_000 });
    } catch (error) {
      // JSON roto: cuenta como un plan que no cumple; la cuota y la falta de conexión se informan tal cual.
      if (error instanceof ErrorDeNegocio && error.codigo === 'ERROR_LLM' && intento === 1) continue;
      throw error;
    }
    const r = validarPlanGenerado(crudo, contexto);
    if (r.ok) contenido = r.contenido;
    else console.warn(`Plan de estudio descartado (intento ${intento}): ${r.motivo}`);
  }
  if (!contenido) throw new ErrorDeNegocio('PLAN_INVALIDO');
  const aceptado = contenido;

  const huella = await huellaActual(usuarioId, d);
  const planId = await conTransaccion(async (tx) => {
    const { planId: id, ultimo } = await bloquearPlan(tx, usuarioId, corteId);
    await insertarVersion(tx, id, usuarioId, ultimo + 1, 'asistente', aceptado, huella);
    return id;
  });
  return armarPlan(usuarioId, d, planId);
}

/**
 * 9.4 "Editar": guarda los pasos editados como una versión `manual`. Conserva la huella de la vigente: editar no
 * cuenta como actualizar con los datos nuevos (el aviso RB-23 sigue si había cambios).
 */
export async function guardarVersionManual(usuarioId: string, corteId: string, pasos: readonly PasoEditado[], hoy: string = hoyBogota()): Promise<PlanCorte> {
  const d = await cargarCorte(usuarioId, corteId);
  const confirmados = new Set((await temasConfirmados(usuarioId, corteId)).map((t) => t.id));
  const planId = await conTransaccion(async (tx) => {
    const plan = (await tx.query<{ id: string }>('SELECT id FROM planes_estudio WHERE corte_id = $1 AND usuario_id = $2 FOR UPDATE', [corteId, usuarioId])).rows[0];
    if (!plan) throw new ErrorDeNegocio('PLAN_NO_ENCONTRADO');
    const vigente = (await tx.query<{ numero: number; contenido: ContenidoPlan; huella: unknown }>('SELECT numero, contenido, huella FROM versiones_plan WHERE plan_id = $1 ORDER BY numero DESC LIMIT 1', [plan.id])).rows[0];
    if (!vigente) throw new ErrorDeNegocio('PLAN_NO_ENCONTRADO');
    const contenido = validarPlanManual(pasos, { anteriores: pasosDe(vigente.contenido), temasConfirmados: confirmados, hoy, fechaCorte: d.fecha, nuevoId: randomUUID });
    await insertarVersion(tx, plan.id, usuarioId, vigente.numero + 1, 'manual', contenido, vigente.huella);
    return plan.id;
  });
  return armarPlan(usuarioId, d, planId);
}

/** 9.4 "Restaurar": copia una versión anterior (con su huella) como versión nueva. */
export async function restaurarVersion(usuarioId: string, corteId: string, numero: number): Promise<PlanCorte> {
  const d = await cargarCorte(usuarioId, corteId);
  const planId = await conTransaccion(async (tx) => {
    const plan = (await tx.query<{ id: string }>('SELECT id FROM planes_estudio WHERE corte_id = $1 AND usuario_id = $2 FOR UPDATE', [corteId, usuarioId])).rows[0];
    if (!plan) throw new ErrorDeNegocio('PLAN_NO_ENCONTRADO');
    const copia = (await tx.query<{ contenido: ContenidoPlan; huella: unknown }>('SELECT contenido, huella FROM versiones_plan WHERE plan_id = $1 AND numero = $2', [plan.id, numero])).rows[0];
    if (!copia) throw new ErrorDeNegocio('VERSION_NO_ENCONTRADA');
    const ultimo = (await tx.query<{ n: number }>('SELECT MAX(numero)::int AS n FROM versiones_plan WHERE plan_id = $1', [plan.id])).rows[0]?.n ?? 0;
    await insertarVersion(tx, plan.id, usuarioId, ultimo + 1, 'restaurada', copia.contenido, copia.huella);
    return plan.id;
  });
  return armarPlan(usuarioId, d, planId);
}
