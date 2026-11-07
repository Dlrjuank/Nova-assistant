import { FRAGMENTOS_RECUPERADOS } from '@/lib/config/nova';
import { llm } from '@/lib/llm/gemini';
import {
  construirContexto,
  etiquetaFragmento,
  etiquetaTarea,
  SIN_DOCUMENTOS_RESPUESTA,
  SIN_RESPUESTA,
  SIN_TAREAS_PENDIENTES,
  SYSTEM_PROMPT,
  type FragmentoContexto,
  type TareaContexto,
  type TurnoConversacion,
} from '@/lib/llm/prompts';
import { mencionaTareas, normalizarConsulta, textoDeBusqueda, validarConsulta } from '@/lib/reglas/consulta';
import { lineaHoy } from '@/lib/reglas/fechas';
import { existenDocumentos } from './documentos';
import { recuperarFragmentos } from './fragmentos';
import { tareasPendientesComoTexto } from './tareas';
import type { Fragmento, Fuente, RespuestaAsistente } from './tipos';

/**
 * RN-14: fuentes usadas. Se recuperan siempre 4 fragmentos, aunque no todos sirvan, así que se dejan
 * las que el modelo citó; si no citó ninguna por su etiqueta, se devuelven todas las entregadas.
 */
export function armarFuentes(
  respuesta: string,
  fragmentos: FragmentoContexto[],
  tareas: TareaContexto[],
): Fuente[] {
  const entregadas: Fuente[] = [
    ...fragmentos.map((f): Fuente => ({ tipo: 'pdf', etiqueta: etiquetaFragmento(f) })),
    ...tareas.map((t): Fuente => ({ tipo: 'tarea', etiqueta: etiquetaTarea(t.id) })),
  ];
  // Sin el lookahead, "fragmento 1" también coincidiría dentro de "fragmento 12".
  const citadas = entregadas.filter((f) =>
    new RegExp(`${f.etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\d)`).test(respuesta),
  );
  return citadas.length > 0 ? citadas : entregadas;
}

/** CU-03, secuencia de la sección 7.1. `historial`: los últimos mensajes de la conversación (RN-21). */
export async function consultar(
  usuarioId: string,
  pregunta: string,
  historial: TurnoConversacion[] = [],
): Promise<RespuestaAsistente> {
  validarConsulta(pregunta); // RN-02
  const preguntaNormal = normalizarConsulta(pregunta);
  const anterior = historial.findLast((m) => m.autor === 'usuario')?.texto;
  const busqueda = textoDeBusqueda(preguntaNormal, anterior); // RN-21

  // RB-32 (reemplaza a RN-15 y al último caso de RB-30): la consulta nunca se bloquea por falta de documentos.
  const hayDocumentos = await existenDocumentos(usuarioId);
  let fragmentos: Fragmento[] = [];
  if (hayDocumentos) {
    const vector = await llm.generarEmbedding(busqueda);
    fragmentos = await recuperarFragmentos(usuarioId, vector, FRAGMENTOS_RECUPERADOS); // RN-12
  }
  // Con documentos, las tareas van si la pregunta las menciona (RN-12); sin documentos, siempre (RB-30).
  const tareasConsultadas = !hayDocumentos || mencionaTareas(busqueda);
  const tareas: TareaContexto[] = tareasConsultadas ? await tareasPendientesComoTexto(usuarioId) : [];

  const respuesta = await llm.responder({
    sistema: SYSTEM_PROMPT,
    contexto: construirContexto(fragmentos, tareas, lineaHoy(), { tareasConsultadas, hayDocumentos }), // RB-31, RB-32
    pregunta: preguntaNormal,
    historial,
  }); // RN-13

  // RB-32: sin tareas pendientes, la respuesta sobre tareas es exacta y sin fuentes.
  if (tareasConsultadas && tareas.length === 0 && respuesta.includes(SIN_TAREAS_PENDIENTES.slice(0, -1))) {
    return { respuesta: SIN_TAREAS_PENDIENTES, fuentes: [] };
  }
  // Sin respuesta en el contexto: mensaje exacto de la sección 5.1; sin documentos, se explica por qué (RB-32).
  if (respuesta.startsWith(SIN_RESPUESTA) || respuesta.startsWith(SIN_DOCUMENTOS_RESPUESTA.slice(0, 30))) {
    return { respuesta: hayDocumentos ? SIN_RESPUESTA : SIN_DOCUMENTOS_RESPUESTA, fuentes: [] };
  }
  return { respuesta, fuentes: armarFuentes(respuesta, fragmentos, tareas) };
}
