import { CONVERSACION_MAX_MENSAJES, CONVERSACION_MENSAJES_CONTEXTO } from '@/lib/config/nova';
import { consultar as consultarBd, conTransaccion } from '@/lib/db/conexion';
import { llm } from '@/lib/llm/gemini';
import { construirContexto, SYSTEM_PROMPT, type TurnoConversacion } from '@/lib/llm/prompts';
import { compactarCitas, recortarEtiqueta } from '@/lib/reglas/citas';
import { normalizarConsulta } from '@/lib/reglas/consulta';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { lineaHoy } from '@/lib/reglas/fechas';
import { soloTextoDePagina } from '@/lib/reglas/libros';
import { BUSCAR_EN_WIKIPEDIA, origenDeBuscarEn, type OrigenMensaje } from '@/lib/reglas/fuentesWeb';
import { MODOS_EXPLICAR, type ModoExplicar } from '@/lib/reglas/preguntasLibro';
import { consultar } from './consulta';
import { responderConFuentesWeb, responderConWikipedia } from './consultaWeb';
import { fragmentosPorIds } from './fragmentos';
import type { Continuacion, ContextoMensaje, ConversacionActual, Fuente, MensajeGuardado, RespuestaConHistorial } from './tipos';

// RN-20: cada usuario puede tener varias conversaciones; la pantalla muestra la más reciente.

async function ultimaConversacion(usuarioId: string): Promise<string | null> {
  const [fila] = await consultarBd<{ id: string }>(
    'SELECT id FROM conversaciones WHERE usuario_id = $1 ORDER BY actualizada_en DESC LIMIT 1',
    [usuarioId],
  );
  return fila?.id ?? null;
}

type MensajeConContexto = MensajeGuardado & { contexto?: ContextoMensaje | null };

/** Los últimos `limite` mensajes de una conversación, del más antiguo al más reciente. */
async function ultimosMensajes(conversacionId: string, limite: number): Promise<MensajeConContexto[]> {
  return consultarBd<MensajeConContexto>(
    `SELECT id, autor, texto, fuentes, contexto, origen FROM (
       SELECT id, autor, texto, fuentes, contexto, origen FROM mensajes_chat
       WHERE conversacion_id = $1
       ORDER BY id DESC
       LIMIT $2
     ) recientes
     ORDER BY id`,
    [conversacionId, limite],
  );
}

/** RB-61: el historial que recibe el modelo solo tiene mensajes del mismo origen; null = documentos y tareas. */
async function mensajesDelOrigen(conversacionId: string, limite: number, origen: OrigenMensaje | null): Promise<MensajeConContexto[]> {
  return consultarBd<MensajeConContexto>(
    `SELECT id, autor, texto, fuentes, contexto, origen FROM (
       SELECT id, autor, texto, fuentes, contexto, origen FROM mensajes_chat
       WHERE conversacion_id = $1 AND origen IS NOT DISTINCT FROM $3::text
       ORDER BY id DESC
       LIMIT $2
     ) recientes
     ORDER BY id`,
    [conversacionId, limite, origen],
  );
}

/** RB-40: un capítulo solo sigue si su parte es lo último de la conversación, aunque haya otro origen en medio. */
async function continuacionVigente(conversacionId: string, ultimo: MensajeConContexto | undefined): Promise<Continuacion | undefined> {
  const continuacion = ultimo?.contexto?.continuacion;
  if (!continuacion) return undefined;
  const [fila] = await consultarBd<{ id: string | number }>('SELECT max(id) AS id FROM mensajes_chat WHERE conversacion_id = $1', [conversacionId]);
  return fila && Number(fila.id) === Number(ultimo?.id) ? continuacion : undefined;
}

/** La conversación más reciente del usuario con sus mensajes, o null si nunca ha preguntado. */
export async function conversacionActual(usuarioId: string): Promise<ConversacionActual | null> {
  const id = await ultimaConversacion(usuarioId);
  if (!id) return null;
  const mensajes = await ultimosMensajes(id, CONVERSACION_MAX_MENSAJES);
  // El contexto no sale al navegador: solo si la respuesta se puede explicar de otra manera (RB-41).
  return { id, mensajes: mensajes.map(({ contexto, ...m }) => (contexto?.fragmentos?.length ? { ...m, explicable: true } : m)) };
}

/** "Conversación nueva". Las anteriores se conservan. Si la más reciente sigue vacía, se reutiliza. */
export async function crearConversacion(usuarioId: string): Promise<{ id: string }> {
  const [vacia] = await consultarBd<{ id: string }>(
    `WITH ultima AS (
       SELECT id FROM conversaciones WHERE usuario_id = $1 ORDER BY actualizada_en DESC LIMIT 1
     )
     SELECT id FROM ultima WHERE NOT EXISTS (SELECT 1 FROM mensajes_chat m WHERE m.conversacion_id = ultima.id)`,
    [usuarioId],
  );
  if (vacia) return vacia;
  const [nueva] = await consultarBd<{ id: string }>('INSERT INTO conversaciones (usuario_id) VALUES ($1) RETURNING id', [
    usuarioId,
  ]);
  return nueva as { id: string };
}

/** Con id, debe ser del usuario. Sin id, la más reciente; si no tiene ninguna, se crea. */
async function resolverConversacion(usuarioId: string, conversacionId?: string | undefined): Promise<string> {
  if (conversacionId) {
    const filas = await consultarBd<{ id: string }>(
      'SELECT id FROM conversaciones WHERE id = $1 AND usuario_id = $2',
      [conversacionId, usuarioId],
    );
    if (filas.length === 0) throw new ErrorDeNegocio('CONVERSACION_NO_ENCONTRADA');
    return conversacionId;
  }
  return (await ultimaConversacion(usuarioId)) ?? (await crearConversacion(usuarioId)).id;
}

/**
 * CU-03 con historial. El modelo recibe los últimos mensajes de la conversación (RN-21). Solo se guarda una
 * pregunta que obtuvo respuesta, junto con ella y en una transacción (RN-20). Si el guardado falla, la
 * respuesta se entrega igual: ya se gastó la cuota de Gemini.
 */
export async function consultarYRegistrar(
  usuarioId: string,
  pregunta: string,
  conversacionId?: string | undefined,
  documentoId?: string | undefined,
): Promise<RespuestaConHistorial> {
  const id = await resolverConversacion(usuarioId, conversacionId);
  const origen = origenDeBuscarEn(documentoId); // E10c2: "Fuentes web" y "Wikipedia"
  const previos = await mensajesDelOrigen(id, CONVERSACION_MENSAJES_CONTEXTO, origen);
  const historial: TurnoConversacion[] = previos.map((m) => ({ autor: m.autor, texto: m.texto }));
  if (origen) {
    const resultado = origen === BUSCAR_EN_WIKIPEDIA ? await responderConWikipedia(pregunta) : await responderConFuentesWeb(usuarioId, pregunta, historial);
    return guardarTurno(usuarioId, id, normalizarConsulta(pregunta), resultado, origen);
  }
  const continuacion = await continuacionVigente(id, previos.at(-1));
  const resultado = await consultar(usuarioId, pregunta, historial, { documentoId, continuacion });
  return guardarTurno(usuarioId, id, normalizarConsulta(pregunta), resultado);
}

const SQL_MENSAJE =
  'INSERT INTO mensajes_chat (conversacion_id, usuario_id, autor, texto, fuentes, contexto, origen) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7) RETURNING id';

/** Guarda la pregunta y la respuesta en una transacción. Si falla, la respuesta se entrega igual. */
async function guardarTurno(
  usuarioId: string,
  conversacionId: string,
  texto: string,
  { respuesta, fuentes, contexto }: { respuesta: string; fuentes: Fuente[]; contexto?: ContextoMensaje | undefined },
  origen: OrigenMensaje | null = null,
): Promise<RespuestaConHistorial> {
  const base = { respuesta, fuentes, conversacionId, ...(origen ? { origen } : {}) };
  try {
    const mensajeId = await conTransaccion(async (tx) => {
      await tx.query(SQL_MENSAJE, [conversacionId, usuarioId, 'usuario', texto, '[]', null, origen]);
      const { rows } = await tx.query<{ id: string | number }>(SQL_MENSAJE, [
        conversacionId,
        usuarioId,
        'asistente',
        respuesta,
        JSON.stringify(fuentes),
        contexto ? JSON.stringify(contexto) : null,
        origen,
      ]);
      await tx.query('UPDATE conversaciones SET actualizada_en = now() WHERE id = $1', [conversacionId]);
      return rows[0]?.id;
    });
    if (mensajeId === undefined) return { ...base, guardada: true };
    return { ...base, guardada: true, mensajeId: Number(mensajeId), explicable: Boolean(contexto?.fragmentos.length) };
  } catch (error) {
    console.error('No se pudo guardar el mensaje en el historial:', error instanceof Error ? error.message : error);
    return { ...base, guardada: false };
  }
}

/**
 * RB-41: vuelve a explicar una respuesta con exactamente sus mismos fragmentos, sin buscar otra vez,
 * y conserva sus citas. Queda en el historial como un turno más.
 */
export async function explicarRespuesta(usuarioId: string, mensajeId: number, modo: ModoExplicar): Promise<RespuestaConHistorial> {
  const [original] = await consultarBd<{ id: number; conversacion_id: string; texto: string; fuentes: Fuente[]; contexto: ContextoMensaje | null }>(
    `SELECT id, conversacion_id, texto, fuentes, contexto FROM mensajes_chat WHERE id = $1 AND usuario_id = $2 AND autor = 'asistente'`,
    [mensajeId, usuarioId],
  );
  const ids = original?.contexto?.fragmentos ?? [];
  if (!original || ids.length === 0) throw new ErrorDeNegocio('MENSAJE_NO_ENCONTRADO');
  const encontrados = await fragmentosPorIds(usuarioId, ids);
  if (encontrados.length === 0) throw new ErrorDeNegocio('MENSAJE_NO_ENCONTRADO'); // se eliminó el documento
  const limite = original?.contexto?.limitePaginas;
  const paginaPdf = original?.contexto?.paginaPdf;
  const inicios = encontrados[0]?.inicio_paginas;
  const delContexto = paginaPdf && inicios ? soloTextoDePagina(encontrados, paginaPdf, inicios) : encontrados; // RB-39: solo el texto de esa página
  const fragmentos = delContexto.map((f) => (limite && f.etiqueta_paginas ? { ...f, etiqueta_paginas: recortarEtiqueta(f.etiqueta_paginas, limite) } : f));

  const [pregunta] = await consultarBd<{ texto: string }>(
    `SELECT texto FROM mensajes_chat WHERE conversacion_id = $1 AND id < $2 AND autor = 'usuario' ORDER BY id DESC LIMIT 1`,
    [original.conversacion_id, original.id],
  );
  const opcion = MODOS_EXPLICAR.find((m) => m.id === modo) as (typeof MODOS_EXPLICAR)[number];
  const explicada = await llm.responder({
    sistema: SYSTEM_PROMPT,
    contexto: construirContexto(fragmentos, [], lineaHoy(), { tareasConsultadas: false, hayDocumentos: true }),
    pregunta: `Explica de nuevo tu respuesta anterior ${opcion.instruccion}. Usa solo el contexto y conserva las citas.`,
    historial: [...(pregunta ? [{ autor: 'usuario' as const, texto: pregunta.texto }] : []), { autor: 'asistente' as const, texto: original.texto }],
  });
  return guardarTurno(usuarioId, original.conversacion_id, `Explícalo: ${opcion.texto}`, {
    respuesta: compactarCitas(explicada, { limite }),
    fuentes: original.fuentes,
    contexto: { fragmentos: ids, ...(limite ? { limitePaginas: limite } : {}), ...(paginaPdf ? { paginaPdf } : {}) },
  });
}
