import { CONVERSACION_MAX_MENSAJES, CONVERSACION_MENSAJES_CONTEXTO } from '@/lib/config/nova';
import { consultar as consultarBd, conTransaccion } from '@/lib/db/conexion';
import type { TurnoConversacion } from '@/lib/llm/prompts';
import { normalizarConsulta } from '@/lib/reglas/consulta';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { consultar } from './consulta';
import type { ConversacionActual, MensajeGuardado, RespuestaConHistorial } from './tipos';

// RN-20: cada usuario puede tener varias conversaciones; la pantalla muestra la más reciente.

async function ultimaConversacion(usuarioId: string): Promise<string | null> {
  const [fila] = await consultarBd<{ id: string }>(
    'SELECT id FROM conversaciones WHERE usuario_id = $1 ORDER BY actualizada_en DESC LIMIT 1',
    [usuarioId],
  );
  return fila?.id ?? null;
}

/** Los últimos `limite` mensajes de una conversación, del más antiguo al más reciente. */
async function ultimosMensajes(conversacionId: string, limite: number): Promise<MensajeGuardado[]> {
  return consultarBd<MensajeGuardado>(
    `SELECT id, autor, texto, fuentes FROM (
       SELECT id, autor, texto, fuentes FROM mensajes_chat
       WHERE conversacion_id = $1
       ORDER BY id DESC
       LIMIT $2
     ) recientes
     ORDER BY id`,
    [conversacionId, limite],
  );
}

/** La conversación más reciente del usuario con sus mensajes, o null si nunca ha preguntado. */
export async function conversacionActual(usuarioId: string): Promise<ConversacionActual | null> {
  const id = await ultimaConversacion(usuarioId);
  if (!id) return null;
  return { id, mensajes: await ultimosMensajes(id, CONVERSACION_MAX_MENSAJES) };
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
): Promise<RespuestaConHistorial> {
  const id = await resolverConversacion(usuarioId, conversacionId);
  const previos = await ultimosMensajes(id, CONVERSACION_MENSAJES_CONTEXTO);
  const historial: TurnoConversacion[] = previos.map((m) => ({ autor: m.autor, texto: m.texto }));
  const resultado = await consultar(pregunta, historial);
  try {
    await conTransaccion(async (tx) => {
      const sql =
        'INSERT INTO mensajes_chat (conversacion_id, usuario_id, autor, texto, fuentes) VALUES ($1, $2, $3, $4, $5::jsonb)';
      await tx.query(sql, [id, usuarioId, 'usuario', normalizarConsulta(pregunta), '[]']);
      await tx.query(sql, [id, usuarioId, 'asistente', resultado.respuesta, JSON.stringify(resultado.fuentes)]);
      await tx.query('UPDATE conversaciones SET actualizada_en = now() WHERE id = $1', [id]);
    });
    return { ...resultado, conversacionId: id, guardada: true };
  } catch (error) {
    console.error('No se pudo guardar el mensaje en el historial:', error instanceof Error ? error.message : error);
    return { ...resultado, conversacionId: id, guardada: false };
  }
}
