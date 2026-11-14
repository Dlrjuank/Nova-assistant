import type { PoolClient } from 'pg';
import { consultar, conTransaccion } from '@/lib/db/conexion';
import { ESQUEMA_CUESTIONARIO, pedidoCuestionario, SYSTEM_PROMPT_CUESTIONARIO } from '@/lib/llm/cuestionario';
import { llm } from '@/lib/llm/gemini';
import { recortarEtiqueta } from '@/lib/reglas/citas';
import {
  barajarMultiple,
  barajarOpciones,
  elegirFragmentos,
  etiquetaDeCita,
  inicioDeFragmento,
  recortarAPaginas,
  FRAGMENTOS_POR_PREGUNTA,
  minimoFragmentos,
  minimoPreguntas,
  rangoValido,
  textoAlcance,
  validarPreguntas,
  type Cantidad,
  type Dificultad,
  type PreguntaValida,
} from '@/lib/reglas/cuestionarios';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { citaDePaginas } from '@/lib/reglas/libros';
import {
  completarCorrecta,
  faltanPorTipo,
  intercalarPorTipo,
  puntajeIntento,
  puntosMultiple,
  PUNTOS_AUTOEVALUACION,
  repartoPorTipo,
  TEXTO_ABIERTA_MAX,
  TEXTO_COMPLETAR_MAX,
  TIPO_POR_DEFECTO,
  totalReparto,
  type Autoevaluacion,
  type TipoCuestionario,
  type TipoPregunta,
} from '@/lib/reglas/tiposPregunta';
import { sugerenciasDeRepaso, type Consulta } from './historialCuestionarios';
import type { CuestionarioCreado, CuestionarioVista, PreguntaVista, RespuestaVista, ResultadoRespuesta } from './tipos';

export type DatosCuestionario = {
  documentoId: string;
  pedidas: Cantidad;
  dificultad: Dificultad;
  /** E10g (RB-64): por defecto, mixto. */
  tipo?: TipoCuestionario | undefined;
} & ({ alcance: 'documento' } | { alcance: 'capitulo'; capitulo: number } | { alcance: 'paginas'; desde: number; hasta: number });

// La ruta tiene 120 s: la primera llamada puede usar casi todo; la segunda solo si queda tiempo de sobra.
const PRESUPUESTO_MS = 105_000;
const SEGUNDA_LLAMADA_HASTA_MS = 55_000;

interface FilaFragmento {
  numero: number;
  contenido: string;
  pagina_inicio: number | null;
  pagina_fin: number | null;
  etiqueta_paginas: string | null;
}

interface FilaCapitulo {
  id: string;
  orden: number;
  nivel: number;
  titulo: string;
  pagina_inicio: number;
  pagina_fin: number;
  etiqueta_paginas: string;
}

const tocaPaginas = (f: FilaFragmento, desde: number, hasta: number) =>
  f.pagina_inicio !== null && f.pagina_fin !== null && f.pagina_inicio <= hasta && f.pagina_fin >= desde;

/** El capítulo de nivel 1 que contiene esa página del PDF. */
const capituloDePagina = (capitulos: readonly FilaCapitulo[], pagina: number | null) =>
  pagina === null ? undefined : capitulos.find((c) => c.nivel === 1 && c.pagina_inicio <= pagina && pagina <= c.pagina_fin);

/** 9.7.3: las columnas de cada tipo, con las opciones barajadas en la única y la múltiple. */
function columnasDeTipo(p: PreguntaValida) {
  const nulas = { opciones: null as string[] | null, correcta: null as number | null, correctas: null as number[] | null, verdadero: null as boolean | null, respuestaTexto: null as string | null };
  switch (p.tipo) {
    case 'unica':
      return { ...nulas, ...barajarOpciones(p.opciones, p.correcta) };
    case 'multiple':
      return { ...nulas, ...barajarMultiple(p.opciones, p.correctas) };
    case 'vf':
      return { ...nulas, verdadero: p.verdadero };
    case 'completar':
    case 'abierta':
      return { ...nulas, respuestaTexto: p.respuesta };
  }
}

/**
 * E10e y E10g (9.6, 9.7, RB-48 a RB-50, RB-52, RB-64): genera las preguntas con a lo sumo 2 llamadas (la segunda,
 * solo por lo que falta de cada tipo) y guarda el cuestionario, sus preguntas y el primer intento en una
 * transacción. Si no alcanza, no guarda nada.
 */
export async function crearCuestionario(usuarioId: string, d: DatosCuestionario): Promise<CuestionarioCreado> {
  const tipo = d.tipo ?? TIPO_POR_DEFECTO;
  const [documento] = await consultar<{ paginas: number | null; progreso: number | null; inicio_paginas: number[] | null }>(
    'SELECT paginas, progreso, inicio_paginas FROM documentos WHERE id = $1 AND usuario_id = $2',
    [d.documentoId, usuarioId],
  );
  if (!documento) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO'); // RB-01
  if (documento.progreso !== null) throw new ErrorDeNegocio('DOCUMENTO_INDEXANDO');
  if (documento.paginas === null) throw new ErrorDeNegocio('DOCUMENTO_SIN_PAGINAS'); // RB-48
  if (d.alcance === 'paginas' && !rangoValido(d.desde, d.hasta, documento.paginas)) {
    throw new ErrorDeNegocio('RANGO_PAGINAS_INVALIDO', `El rango de páginas no es válido: este documento tiene ${documento.paginas} páginas.`);
  }

  const capitulos = await consultar<FilaCapitulo>(
    'SELECT id, orden, nivel, titulo, pagina_inicio, pagina_fin, etiqueta_paginas FROM capitulos WHERE documento_id = $1 AND usuario_id = $2 ORDER BY orden',
    [d.documentoId, usuarioId],
  );
  const capitulo = d.alcance === 'capitulo' ? capitulos.find((c) => c.orden === d.capitulo) : undefined;
  if (d.alcance === 'capitulo' && !capitulo) throw new ErrorDeNegocio('DATOS_INVALIDOS');

  const todos = await consultar<FilaFragmento>(
    'SELECT numero, contenido, pagina_inicio, pagina_fin, etiqueta_paginas FROM fragmentos_pdf WHERE documento_id = $1 ORDER BY numero',
    [d.documentoId],
  );
  const [desde, hasta] =
    d.alcance === 'capitulo' ? [(capitulo as FilaCapitulo).pagina_inicio, (capitulo as FilaCapitulo).pagina_fin] : d.alcance === 'paginas' ? [d.desde, d.hasta] : [1, documento.paginas];
  const tocan = d.alcance === 'documento' ? todos : todos.filter((f) => tocaPaginas(f, desde, hasta));
  // B-60: con dónde empieza cada página (M20), solo el texto del alcance; si no, el fragmento entero y la etiqueta recortada.
  const delAlcance =
    d.alcance !== 'documento' && documento.inicio_paginas?.length
      ? recortarAPaginas(tocan, desde, hasta, documento.inicio_paginas)
      : tocan.map((f) => ({ ...f, inicioPalabra: inicioDeFragmento(f.numero) }));
  // En el libro completo, repartidos entre sus capítulos (9.6.1).
  const conGrupo = delAlcance.map((f) => ({ ...f, grupo: d.alcance === 'documento' ? (capituloDePagina(capitulos, f.pagina_inicio)?.orden ?? -1) : 0 }));
  const elegidos = elegirFragmentos(conGrupo, d.pedidas * FRAGMENTOS_POR_PREGUNTA);
  if (elegidos.length < minimoFragmentos(d.pedidas)) throw new ErrorDeNegocio('CONTENIDO_INSUFICIENTE'); // RB-49, sin gastar cuota

  const etiquetados = new Map(elegidos.map((f, i) => [`F${i + 1}`, f]));
  const entregados = [...etiquetados].map(([etiqueta, f]) => ({ etiqueta, contenido: f.contenido }));
  const reparto = repartoPorTipo(tipo, d.pedidas); // RB-64
  const inicio = Date.now();
  const validas: PreguntaValida[] = [];
  for (let llamada = 1; llamada <= 2; llamada++) {
    const falta = faltanPorTipo(reparto, validas);
    if (totalReparto(falta) === 0) break;
    if (llamada === 2 && Date.now() - inicio > SEGUNDA_LLAMADA_HASTA_MS) break;
    try {
      const crudas = await llm.generarJson({
        sistema: SYSTEM_PROMPT_CUESTIONARIO,
        contenido: pedidoCuestionario(entregados, falta, d.dificultad, validas.map((v) => v.enunciado)),
        esquema: ESQUEMA_CUESTIONARIO,
        tiempoMaximoMs: PRESUPUESTO_MS - (Date.now() - inicio),
      });
      validas.push(...validarPreguntas(crudas, etiquetados, validas.map((v) => v.enunciado), falta));
    } catch (error) {
      if (llamada === 1) throw error; // RB-52: sin cupo, nada se guarda
      console.warn('La segunda llamada del cuestionario falló; se usa lo de la primera:', error instanceof Error ? error.message : error);
    }
  }
  const finales = intercalarPorTipo(validas); // los cupos ya limitan a las pedidas de cada tipo
  if (finales.length < minimoPreguntas(d.pedidas)) throw new ErrorDeNegocio('CONTENIDO_INSUFICIENTE'); // RB-49

  // S-59: la pregunta cuenta para su capítulo de nivel 1; en un cuestionario de un capítulo, ese capítulo (o el que lo contiene).
  const capituloFijo = capitulo ? (capitulo.nivel === 1 ? capitulo : capituloDePagina(capitulos, capitulo.pagina_inicio)) : undefined;
  const limite = capitulo?.etiqueta_paginas ?? (d.alcance === 'paginas' ? `${d.desde}–${d.hasta}` : undefined);
  const preguntas = finales.map((p) => {
    const f = etiquetados.get(p.fuente) as FilaFragmento & { inicioPalabra: number };
    const exacta = etiquetaDeCita(f, p, documento.inicio_paginas);
    const etiqueta = exacta ?? (f.etiqueta_paginas && limite ? recortarEtiqueta(f.etiqueta_paginas, limite) : f.etiqueta_paginas);
    return { ...p, columnas: columnasDeTipo(p), etiqueta, capituloId: (capituloFijo ?? capituloDePagina(capitulos, f.pagina_inicio))?.id ?? null };
  });

  const id = await conTransaccion(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO cuestionarios (usuario_id, documento_id, capitulo_id, pagina_desde, pagina_hasta, alcance, dificultad, pedidas, tipo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        usuarioId,
        d.documentoId,
        capitulo?.id ?? null,
        d.alcance === 'paginas' ? d.desde : null,
        d.alcance === 'paginas' ? d.hasta : null,
        d.alcance,
        d.dificultad,
        d.pedidas,
        tipo,
      ],
    );
    const cuestionarioId = rows[0]?.id as string;
    const ids: string[] = [];
    for (const [i, p] of preguntas.entries()) {
      const c = p.columnas;
      const { rows: fila } = await tx.query<{ id: string }>(
        `INSERT INTO preguntas_cuestionario
           (cuestionario_id, usuario_id, orden, tipo, enunciado, opciones, correcta, correctas, verdadero, respuesta_texto, explicacion, cita_textual, etiqueta_paginas, capitulo_id)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::smallint[], $9, $10, $11, $12, $13, $14) RETURNING id`,
        [
          cuestionarioId,
          usuarioId,
          i + 1,
          p.tipo,
          p.enunciado,
          c.opciones ? JSON.stringify(c.opciones) : null,
          c.correcta,
          c.correctas,
          c.verdadero,
          c.respuestaTexto,
          p.explicacion,
          p.cita,
          p.etiqueta,
          p.capituloId,
        ],
      );
      ids.push(fila[0]?.id as string);
    }
    await tx.query('INSERT INTO intentos_cuestionario (cuestionario_id, usuario_id, preguntas, total) VALUES ($1, $2, $3::uuid[], $4)', [
      cuestionarioId,
      usuarioId,
      ids,
      ids.length,
    ]);
    return cuestionarioId;
  });
  return { id, creadas: preguntas.length, pedidas: d.pedidas };
}

const COLUMNAS_PREGUNTA = 'id, tipo, enunciado, opciones, correcta, correctas, verdadero, respuesta_texto, explicacion, cita_textual, etiqueta_paginas';
const COLUMNAS_RESPUESTA = 'pregunta_id, elegida, elegidas, texto, autoevaluacion, puntos, acierto';

interface FilaPregunta {
  id: string;
  tipo: TipoPregunta;
  enunciado: string;
  opciones: string[] | null;
  correcta: number | null;
  correctas: number[] | null;
  verdadero: boolean | null;
  respuesta_texto: string | null;
  explicacion: string;
  cita_textual: string;
  etiqueta_paginas: string | null;
}

interface FilaRespuesta {
  pregunta_id: string;
  elegida: number | null;
  elegidas: number[] | null;
  texto: string | null;
  autoevaluacion: Autoevaluacion | null;
  puntos: number | null;
  acierto: boolean | null;
}

const fuenteDe = (nombre: string, etiqueta: string | null) => (etiqueta ? `${nombre} · ${citaDePaginas(etiqueta)}` : nombre);

/** Lo respondido y la solución, según el tipo; solo de una pregunta ya respondida (RB-50). */
function vistaRespuesta(p: FilaPregunta, nombre: string, r: FilaRespuesta): RespuestaVista {
  const base: RespuestaVista = { puntos: r.puntos, acierto: r.acierto, explicacion: p.explicacion, cita: p.cita_textual, fuente: fuenteDe(nombre, p.etiqueta_paginas) };
  switch (p.tipo) {
    case 'unica':
      return { ...base, elegida: r.elegida as number, correcta: p.correcta as number };
    case 'multiple':
      return { ...base, elegidas: r.elegidas ?? [], correctas: p.correctas ?? [] };
    case 'vf':
      return { ...base, respondioVerdadero: r.elegida === 1, verdadero: p.verdadero as boolean };
    case 'completar':
      return { ...base, texto: r.texto ?? '', respuestaCorrecta: p.respuesta_texto as string };
    case 'abierta':
      return { ...base, texto: r.texto ?? '', respuestaCorrecta: p.respuesta_texto as string, autoevaluacion: r.autoevaluacion };
  }
}

/** RB-50: antes de responder solo el enunciado, las opciones y, en la múltiple, cuántas son correctas. */
function vistaPregunta(p: FilaPregunta, nombre: string, respuesta?: FilaRespuesta): PreguntaVista {
  const base: PreguntaVista = { id: p.id, tipo: p.tipo, enunciado: p.enunciado };
  if (p.opciones) base.opciones = p.opciones;
  if (p.tipo === 'multiple') base.cuantasCorrectas = p.correctas?.length ?? 0;
  if (respuesta) base.respuesta = vistaRespuesta(p, nombre, respuesta);
  return base;
}

/** E10e: el cuestionario con su intento más reciente. Uno ajeno responde como inexistente (RB-01). */
export async function obtenerCuestionario(usuarioId: string, id: string): Promise<CuestionarioVista> {
  const [c] = await consultar<{
    documento_id: string;
    nombre: string;
    categoria: string;
    alcance: 'documento' | 'capitulo' | 'paginas';
    capitulo: string | null;
    pagina_desde: number | null;
    pagina_hasta: number | null;
    dificultad: Dificultad;
    pedidas: number;
    tipo: TipoCuestionario;
  }>(
    `SELECT c.documento_id, d.nombre_archivo AS nombre, d.categoria, c.alcance, cap.titulo AS capitulo, c.pagina_desde, c.pagina_hasta, c.dificultad, c.pedidas, c.tipo
     FROM cuestionarios c
     JOIN documentos d ON d.id = c.documento_id
     LEFT JOIN capitulos cap ON cap.id = c.capitulo_id
     WHERE c.id = $1 AND c.usuario_id = $2`,
    [id, usuarioId],
  );
  if (!c) throw new ErrorDeNegocio('CUESTIONARIO_NO_ENCONTRADO');
  const [intento] = await consultar<{ id: string; preguntas: string[]; repaso_de: string | null; aciertos: number | null; total: number; puntaje: number | null; terminado: boolean }>(
    `SELECT id, preguntas, repaso_de, aciertos, total, puntaje, terminado_en IS NOT NULL AS terminado
     FROM intentos_cuestionario WHERE cuestionario_id = $1 AND usuario_id = $2 ORDER BY iniciado_en DESC LIMIT 1`,
    [id, usuarioId],
  );
  if (!intento) throw new ErrorDeNegocio('CUESTIONARIO_NO_ENCONTRADO');
  const filas = await consultar<FilaPregunta>(`SELECT ${COLUMNAS_PREGUNTA} FROM preguntas_cuestionario WHERE id = ANY($1::uuid[]) AND usuario_id = $2`, [
    intento.preguntas,
    usuarioId,
  ]);
  const respuestas = await consultar<FilaRespuesta>(`SELECT ${COLUMNAS_RESPUESTA} FROM respuestas_intento WHERE intento_id = $1 AND usuario_id = $2`, [intento.id, usuarioId]);
  const porId = new Map(filas.map((p) => [p.id, p]));
  const respuestaDe = new Map(respuestas.map((r) => [r.pregunta_id, r]));
  const sugerencias = intento.terminado ? await sugerenciasDeRepaso(consultar as Consulta, usuarioId, intento.id) : [];
  return {
    id,
    tipo: c.tipo ?? 'unica',
    documento: { id: c.documento_id, nombre: c.nombre, categoria: c.categoria },
    alcance: textoAlcance(c.alcance, c.capitulo, c.pagina_desde, c.pagina_hasta),
    dificultad: c.dificultad,
    pedidas: c.pedidas,
    intento: {
      id: intento.id,
      repaso: intento.repaso_de !== null,
      terminado: intento.terminado,
      aciertos: intento.aciertos,
      total: intento.total,
      puntaje: intento.puntaje,
      preguntas: intento.preguntas.flatMap((pid) => {
        const p = porId.get(pid);
        return p ? [vistaPregunta(p, c.nombre, respuestaDe.get(pid))] : [];
      }),
      sugerencias,
    },
  };
}

/**
 * E10e (5.11): "Hacer de nuevo" con todas, o "Repetir solo las que fallé" de un intento terminado. Sin Gemini.
 * E10g (7.12): fallada es toda pregunta con menos de 1 punto (una abierta "A medias", una múltiple parcial).
 */
export async function empezarIntento(usuarioId: string, cuestionarioId: string, repasoDe?: string | undefined): Promise<{ id: string }> {
  const [cuestionario] = await consultar<{ id: string }>('SELECT id FROM cuestionarios WHERE id = $1 AND usuario_id = $2', [cuestionarioId, usuarioId]);
  if (!cuestionario) throw new ErrorDeNegocio('CUESTIONARIO_NO_ENCONTRADO');
  let preguntas: string[];
  if (repasoDe) {
    const [base] = await consultar<{ preguntas: string[] }>(
      'SELECT preguntas FROM intentos_cuestionario WHERE id = $1 AND cuestionario_id = $2 AND usuario_id = $3 AND terminado_en IS NOT NULL',
      [repasoDe, cuestionarioId, usuarioId],
    );
    if (!base) throw new ErrorDeNegocio('CUESTIONARIO_NO_ENCONTRADO');
    const falladas = new Set(
      (await consultar<{ pregunta_id: string }>('SELECT pregunta_id FROM respuestas_intento WHERE intento_id = $1 AND usuario_id = $2 AND puntos < 100', [repasoDe, usuarioId])).map(
        (r) => r.pregunta_id,
      ),
    );
    preguntas = base.preguntas.filter((p) => falladas.has(p));
    if (preguntas.length === 0) throw new ErrorDeNegocio('DATOS_INVALIDOS');
  } else {
    preguntas = (await consultar<{ id: string }>('SELECT id FROM preguntas_cuestionario WHERE cuestionario_id = $1 AND usuario_id = $2 ORDER BY orden', [cuestionarioId, usuarioId])).map(
      (p) => p.id,
    );
  }
  const [nuevo] = await consultar<{ id: string }>(
    'INSERT INTO intentos_cuestionario (cuestionario_id, usuario_id, preguntas, repaso_de, total) VALUES ($1, $2, $3::uuid[], $4, $5) RETURNING id',
    [cuestionarioId, usuarioId, preguntas, repasoDe ?? null, preguntas.length],
  );
  return { id: nuevo?.id as string };
}

/** E10g: lo que manda el navegador según el tipo de la pregunta (10, `POST /api/nova/intentos/[id]/respuestas`). */
export type RespuestaEnviada = { elegida: number } | { elegidas: number[] } | { verdadero: boolean } | { texto: string };

interface Guardar {
  elegida: number | null;
  elegidas: number[] | null;
  texto: string | null;
  puntos: number | null;
}

/** RB-65 a RB-69: lo que se guarda y cuántos puntos vale, o null si la respuesta no corresponde al tipo. */
function calificar(p: FilaPregunta, r: RespuestaEnviada): Guardar | null {
  const nada = { elegida: null, elegidas: null, texto: null };
  switch (p.tipo) {
    case 'unica':
      return 'elegida' in r ? { ...nada, elegida: r.elegida, puntos: r.elegida === p.correcta ? 100 : 0 } : null;
    case 'multiple': {
      if (!('elegidas' in r)) return null;
      const marcadas = [...new Set(r.elegidas)].sort((a, b) => a - b);
      if (marcadas.length !== r.elegidas.length || marcadas.length === 0 || marcadas.some((e) => !Number.isInteger(e) || e < 0 || e > 3)) return null;
      return { ...nada, elegidas: marcadas, puntos: puntosMultiple(p.correctas ?? [], marcadas) };
    }
    case 'vf':
      return 'verdadero' in r ? { ...nada, elegida: r.verdadero ? 1 : 0, puntos: r.verdadero === p.verdadero ? 100 : 0 } : null;
    case 'completar': {
      const texto = 'texto' in r ? r.texto.trim() : '';
      if (!texto || texto.length > TEXTO_COMPLETAR_MAX) return null;
      return { ...nada, texto, puntos: completarCorrecta(texto, p.respuesta_texto as string) ? 100 : 0 };
    }
    case 'abierta': {
      const texto = 'texto' in r ? r.texto.trim() : '';
      if (!texto || texto.length > TEXTO_ABIERTA_MAX) return null;
      return { ...nada, texto, puntos: null }; // RB-68: los puntos llegan con la autoevaluación
    }
  }
}

interface IntentoBloqueado {
  preguntas: string[];
  total: number;
  nombre: string;
}

/** El intento bloqueado y la pregunta; una pregunta ajena al intento o de otro usuario responde como inexistente. */
async function cargarPregunta(tx: PoolClient, usuarioId: string, intentoId: string, preguntaId: string): Promise<{ intento: IntentoBloqueado; pregunta: FilaPregunta }> {
  const { rows: intentos } = await tx.query<IntentoBloqueado>(
    `SELECT i.preguntas, i.total, d.nombre_archivo AS nombre
     FROM intentos_cuestionario i
     JOIN cuestionarios c ON c.id = i.cuestionario_id
     JOIN documentos d ON d.id = c.documento_id
     WHERE i.id = $1 AND i.usuario_id = $2
     FOR UPDATE OF i`,
    [intentoId, usuarioId],
  );
  const intento = intentos[0];
  if (!intento || !intento.preguntas.includes(preguntaId)) throw new ErrorDeNegocio('PREGUNTA_NO_ENCONTRADA');
  const { rows } = await tx.query<FilaPregunta>(`SELECT ${COLUMNAS_PREGUNTA} FROM preguntas_cuestionario WHERE id = $1 AND usuario_id = $2`, [preguntaId, usuarioId]);
  const pregunta = rows[0];
  if (!pregunta) throw new ErrorDeNegocio('PREGUNTA_NO_ENCONTRADA');
  return { intento, pregunta };
}

/**
 * Devuelve la respuesta guardada de la pregunta y, si con ella todas tienen puntos (las abiertas, calificadas),
 * califica el intento (7.12) y trae las sugerencias de repaso (RB-53).
 */
async function cerrarSiTermino(tx: PoolClient, usuarioId: string, intentoId: string, intento: IntentoBloqueado, pregunta: FilaPregunta): Promise<ResultadoRespuesta> {
  const { rows: todas } = await tx.query<FilaRespuesta>(`SELECT ${COLUMNAS_RESPUESTA} FROM respuestas_intento WHERE intento_id = $1`, [intentoId]);
  const guardada = todas.find((r) => r.pregunta_id === pregunta.id) as FilaRespuesta;
  let resultado: ResultadoRespuesta['resultado'];
  if (todas.length >= intento.total && todas.every((r) => r.puntos !== null)) {
    const aciertos = todas.filter((r) => r.puntos === 100).length;
    const puntaje = puntajeIntento(
      todas.map((r) => r.puntos as number),
      intento.total,
    );
    await tx.query('UPDATE intentos_cuestionario SET aciertos = $2, puntaje = $3, terminado_en = COALESCE(terminado_en, now()) WHERE id = $1', [intentoId, aciertos, puntaje]);
    const consulta: Consulta = async <T>(sql: string, valores: unknown[]) => (await tx.query(sql, valores)).rows as T[];
    resultado = { aciertos, total: intento.total, puntaje, sugerencias: await sugerenciasDeRepaso(consulta, usuarioId, intentoId) };
  }
  return { ...vistaRespuesta(pregunta, intento.nombre, guardada), ...(resultado ? { resultado } : {}) };
}

/**
 * E10e y E10g (RB-51, RB-65 a RB-69): guarda la respuesta una sola vez, según el tipo de la pregunta. Repetirla
 * devuelve la que quedó guardada, sin cambiarla. Una respuesta que no corresponde al tipo se rechaza sin guardar
 * nada. Cuando todas tienen puntos, se califica (7.12).
 */
export async function responderPregunta(usuarioId: string, intentoId: string, preguntaId: string, respuesta: RespuestaEnviada): Promise<ResultadoRespuesta> {
  return conTransaccion(async (tx) => {
    const { intento, pregunta } = await cargarPregunta(tx, usuarioId, intentoId, preguntaId);
    const guardar = calificar(pregunta, respuesta);
    if (!guardar) throw new ErrorDeNegocio('DATOS_INVALIDOS'); // RB-69
    await tx.query(
      `INSERT INTO respuestas_intento (intento_id, pregunta_id, usuario_id, elegida, elegidas, texto, puntos, acierto)
       VALUES ($1, $2, $3, $4, $5::smallint[], $6, $7, $8)
       ON CONFLICT (intento_id, pregunta_id) DO NOTHING`,
      [intentoId, preguntaId, usuarioId, guardar.elegida, guardar.elegidas, guardar.texto, guardar.puntos, guardar.puntos === null ? null : guardar.puntos === 100],
    );
    return cerrarSiTermino(tx, usuarioId, intentoId, intento, pregunta);
  });
}

/**
 * E10g (RB-68, RB-69): el usuario se califica una pregunta abierta ya enviada, una sola vez; repetirlo devuelve la
 * calificación guardada. Calificar otra clase de pregunta, o una abierta sin enviar, se rechaza sin guardar nada.
 */
export async function autoevaluarPregunta(usuarioId: string, intentoId: string, preguntaId: string, calificacion: Autoevaluacion): Promise<ResultadoRespuesta> {
  return conTransaccion(async (tx) => {
    const { intento, pregunta } = await cargarPregunta(tx, usuarioId, intentoId, preguntaId);
    if (pregunta.tipo !== 'abierta') throw new ErrorDeNegocio('DATOS_INVALIDOS');
    const { rows: enviada } = await tx.query<{ autoevaluacion: Autoevaluacion | null }>(
      'SELECT autoevaluacion FROM respuestas_intento WHERE intento_id = $1 AND pregunta_id = $2 AND usuario_id = $3',
      [intentoId, preguntaId, usuarioId],
    );
    if (!enviada[0]) throw new ErrorDeNegocio('DATOS_INVALIDOS');
    const puntos = PUNTOS_AUTOEVALUACION[calificacion];
    await tx.query(
      `UPDATE respuestas_intento SET autoevaluacion = $4, puntos = $5, acierto = $6
       WHERE intento_id = $1 AND pregunta_id = $2 AND usuario_id = $3 AND autoevaluacion IS NULL`,
      [intentoId, preguntaId, usuarioId, calificacion, puntos, puntos === 100],
    );
    return cerrarSiTermino(tx, usuarioId, intentoId, intento, pregunta);
  });
}
