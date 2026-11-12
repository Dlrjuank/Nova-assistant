import { consultar, conTransaccion } from '@/lib/db/conexion';
import { ESQUEMA_CUESTIONARIO, pedidoCuestionario, SYSTEM_PROMPT_CUESTIONARIO } from '@/lib/llm/cuestionario';
import { llm } from '@/lib/llm/gemini';
import { recortarEtiqueta } from '@/lib/reglas/citas';
import {
  barajarOpciones,
  calcularPuntaje,
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
import { sugerenciasDeRepaso, type Consulta } from './historialCuestionarios';
import type { CuestionarioCreado, CuestionarioVista, PreguntaVista, ResultadoRespuesta } from './tipos';

export type DatosCuestionario = {
  documentoId: string;
  pedidas: Cantidad;
  dificultad: Dificultad;
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

/**
 * E10e (9.6, RB-48 a RB-50, RB-52): genera las preguntas con a lo sumo 2 llamadas y guarda el cuestionario, sus
 * preguntas y el primer intento en una transacción. Si no alcanza, no guarda nada.
 */
export async function crearCuestionario(usuarioId: string, d: DatosCuestionario): Promise<CuestionarioCreado> {
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
  const inicio = Date.now();
  const validas: PreguntaValida[] = [];
  for (let llamada = 1; llamada <= 2 && validas.length < d.pedidas; llamada++) {
    if (llamada === 2 && Date.now() - inicio > SEGUNDA_LLAMADA_HASTA_MS) break;
    try {
      const crudas = await llm.generarJson({
        sistema: SYSTEM_PROMPT_CUESTIONARIO,
        contenido: pedidoCuestionario(entregados, d.pedidas - validas.length, d.dificultad, validas.map((v) => v.enunciado)),
        esquema: ESQUEMA_CUESTIONARIO,
        tiempoMaximoMs: PRESUPUESTO_MS - (Date.now() - inicio),
      });
      validas.push(...validarPreguntas(crudas, etiquetados, validas.map((v) => v.enunciado)));
    } catch (error) {
      if (llamada === 1) throw error; // RB-52: sin cupo, nada se guarda
      console.warn('La segunda llamada del cuestionario falló; se usa lo de la primera:', error instanceof Error ? error.message : error);
    }
  }
  const finales = validas.slice(0, d.pedidas);
  if (finales.length < minimoPreguntas(d.pedidas)) throw new ErrorDeNegocio('CONTENIDO_INSUFICIENTE'); // RB-49

  // S-59: la pregunta cuenta para su capítulo de nivel 1; en un cuestionario de un capítulo, ese capítulo (o el que lo contiene).
  const capituloFijo = capitulo ? (capitulo.nivel === 1 ? capitulo : capituloDePagina(capitulos, capitulo.pagina_inicio)) : undefined;
  const limite = capitulo?.etiqueta_paginas ?? (d.alcance === 'paginas' ? `${d.desde}–${d.hasta}` : undefined);
  const preguntas = finales.map((p) => {
    const f = etiquetados.get(p.fuente) as FilaFragmento & { inicioPalabra: number };
    const exacta = etiquetaDeCita(f, p, documento.inicio_paginas);
    const etiqueta = exacta ?? (f.etiqueta_paginas && limite ? recortarEtiqueta(f.etiqueta_paginas, limite) : f.etiqueta_paginas);
    return { ...p, ...barajarOpciones(p.opciones, p.correcta), etiqueta, capituloId: (capituloFijo ?? capituloDePagina(capitulos, f.pagina_inicio))?.id ?? null };
  });

  const id = await conTransaccion(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO cuestionarios (usuario_id, documento_id, capitulo_id, pagina_desde, pagina_hasta, alcance, dificultad, pedidas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        usuarioId,
        d.documentoId,
        capitulo?.id ?? null,
        d.alcance === 'paginas' ? d.desde : null,
        d.alcance === 'paginas' ? d.hasta : null,
        d.alcance,
        d.dificultad,
        d.pedidas,
      ],
    );
    const cuestionarioId = rows[0]?.id as string;
    const ids: string[] = [];
    for (const [i, p] of preguntas.entries()) {
      const { rows: fila } = await tx.query<{ id: string }>(
        `INSERT INTO preguntas_cuestionario
           (cuestionario_id, usuario_id, orden, enunciado, opciones, correcta, explicacion, cita_textual, etiqueta_paginas, capitulo_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10) RETURNING id`,
        [cuestionarioId, usuarioId, i + 1, p.enunciado, JSON.stringify(p.opciones), p.correcta, p.explicacion, p.cita, p.etiqueta, p.capituloId],
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

interface FilaPregunta {
  id: string;
  enunciado: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
  cita_textual: string;
  etiqueta_paginas: string | null;
}

const fuenteDe = (nombre: string, etiqueta: string | null) => (etiqueta ? `${nombre} · ${citaDePaginas(etiqueta)}` : nombre);

/** RB-50: la correcta, la explicación y la cita solo de las preguntas ya respondidas. */
function vistaPregunta(p: FilaPregunta, nombre: string, respuesta?: { elegida: number; acierto: boolean }): PreguntaVista {
  const base = { id: p.id, enunciado: p.enunciado, opciones: p.opciones };
  if (!respuesta) return base;
  return { ...base, respuesta: { ...respuesta, correcta: p.correcta, explicacion: p.explicacion, cita: p.cita_textual, fuente: fuenteDe(nombre, p.etiqueta_paginas) } };
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
  }>(
    `SELECT c.documento_id, d.nombre_archivo AS nombre, d.categoria, c.alcance, cap.titulo AS capitulo, c.pagina_desde, c.pagina_hasta, c.dificultad, c.pedidas
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
  const filas = await consultar<FilaPregunta>(
    'SELECT id, enunciado, opciones, correcta, explicacion, cita_textual, etiqueta_paginas FROM preguntas_cuestionario WHERE id = ANY($1::uuid[]) AND usuario_id = $2',
    [intento.preguntas, usuarioId],
  );
  const respuestas = await consultar<{ pregunta_id: string; elegida: number; acierto: boolean }>(
    'SELECT pregunta_id, elegida, acierto FROM respuestas_intento WHERE intento_id = $1 AND usuario_id = $2',
    [intento.id, usuarioId],
  );
  const porId = new Map(filas.map((p) => [p.id, p]));
  const respuestaDe = new Map(respuestas.map((r) => [r.pregunta_id, { elegida: r.elegida, acierto: r.acierto }]));
  const sugerencias = intento.terminado ? await sugerenciasDeRepaso(consultar as Consulta, usuarioId, intento.id) : [];
  return {
    id,
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

/** E10e (5.11): "Hacer de nuevo" con todas, o "Repetir solo las que fallé" de un intento terminado. Sin Gemini. */
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
      (await consultar<{ pregunta_id: string }>('SELECT pregunta_id FROM respuestas_intento WHERE intento_id = $1 AND usuario_id = $2 AND NOT acierto', [repasoDe, usuarioId])).map(
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

/**
 * E10e (RB-51): guarda la respuesta una sola vez. Repetirla devuelve la que quedó guardada, sin cambiarla. Una
 * pregunta ajena al intento o de otro usuario responde como inexistente. Con la última, se califica (7.11).
 */
export async function responderPregunta(usuarioId: string, intentoId: string, preguntaId: string, elegida: number): Promise<ResultadoRespuesta> {
  return conTransaccion(async (tx) => {
    const { rows: intentos } = await tx.query<{ preguntas: string[]; total: number; nombre: string }>(
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
    const { rows: preguntas } = await tx.query<FilaPregunta>(
      'SELECT id, enunciado, opciones, correcta, explicacion, cita_textual, etiqueta_paginas FROM preguntas_cuestionario WHERE id = $1 AND usuario_id = $2',
      [preguntaId, usuarioId],
    );
    const pregunta = preguntas[0];
    if (!pregunta) throw new ErrorDeNegocio('PREGUNTA_NO_ENCONTRADA');

    await tx.query(
      `INSERT INTO respuestas_intento (intento_id, pregunta_id, usuario_id, elegida, acierto) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (intento_id, pregunta_id) DO NOTHING`,
      [intentoId, preguntaId, usuarioId, elegida, elegida === pregunta.correcta],
    );
    const { rows: todas } = await tx.query<{ pregunta_id: string; elegida: number; acierto: boolean }>(
      'SELECT pregunta_id, elegida, acierto FROM respuestas_intento WHERE intento_id = $1',
      [intentoId],
    );
    const guardada = todas.find((r) => r.pregunta_id === preguntaId) as { elegida: number; acierto: boolean };
    let resultado: ResultadoRespuesta['resultado'];
    if (todas.length >= intento.total) {
      const aciertos = todas.filter((r) => r.acierto).length;
      const puntaje = calcularPuntaje(aciertos, intento.total);
      await tx.query('UPDATE intentos_cuestionario SET aciertos = $2, puntaje = $3, terminado_en = COALESCE(terminado_en, now()) WHERE id = $1', [intentoId, aciertos, puntaje]);
      const consulta: Consulta = async <T>(sql: string, valores: unknown[]) => (await tx.query(sql, valores)).rows as T[];
      resultado = { aciertos, total: intento.total, puntaje, sugerencias: await sugerenciasDeRepaso(consulta, usuarioId, intentoId) };
    }
    const vista = vistaPregunta(pregunta, intento.nombre, { elegida: guardada.elegida, acierto: guardada.acierto });
    return { ...(vista.respuesta as NonNullable<PreguntaVista['respuesta']>), ...(resultado ? { resultado } : {}) };
  });
}
