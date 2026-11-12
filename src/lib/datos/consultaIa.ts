import { llm } from '@/lib/llm/gemini';
import { SYSTEM_PROMPT_IA, type TurnoConversacion } from '@/lib/llm/prompts';
import { normalizarConsulta, validarConsulta } from '@/lib/reglas/consulta';
import type { RespuestaAsistente } from './tipos';

/** E10c3 (RB-59): solo el modelo de chat, sin embeddings ni contexto; nunca es respaldo de otra búsqueda. */
export async function responderConIa(pregunta: string, historial: TurnoConversacion[] = []): Promise<RespuestaAsistente> {
  validarConsulta(pregunta); // RN-02
  const respuesta = await llm.responder({ sistema: SYSTEM_PROMPT_IA, contexto: '', pregunta: normalizarConsulta(pregunta), historial });
  return { respuesta, fuentes: [] };
}
