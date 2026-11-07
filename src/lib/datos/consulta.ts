import { FRAGMENTOS_RECUPERADOS } from '@/lib/config/nova';
import { llm } from '@/lib/llm/gemini';
import {
  construirContexto,
  etiquetaFragmento,
  etiquetaTarea,
  SIN_RESPUESTA,
  SYSTEM_PROMPT,
  type FragmentoContexto,
  type TareaContexto,
  type TurnoConversacion,
} from '@/lib/llm/prompts';
import { mencionaTareas, normalizarConsulta, textoDeBusqueda, validarConsulta } from '@/lib/reglas/consulta';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
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

  let fragmentos: Fragmento[] = [];
  let tareas: TareaContexto[];
  if (await existenDocumentos(usuarioId)) {
    const vector = await llm.generarEmbedding(busqueda);
    fragmentos = await recuperarFragmentos(usuarioId, vector, FRAGMENTOS_RECUPERADOS); // RN-12
    tareas = mencionaTareas(busqueda) ? await tareasPendientesComoTexto(usuarioId) : []; // RN-12
  } else {
    // RB-30 (reemplaza a RN-15 en la ampliación): sin documentos se responde con las tareas pendientes,
    // siempre (sin filtro por palabras) y sin calcular el vector: no hay fragmentos en qué buscar.
    tareas = await tareasPendientesComoTexto(usuarioId);
    if (tareas.length === 0) throw new ErrorDeNegocio('SIN_DOCUMENTOS');
  }

  const respuesta = await llm.responder({
    sistema: SYSTEM_PROMPT,
    contexto: construirContexto(fragmentos, tareas, lineaHoy()), // RB-31
    pregunta: preguntaNormal,
    historial,
  }); // RN-13

  // Sin respuesta en el contexto: mensaje exacto de la sección 5.1 y ninguna fuente.
  if (respuesta.startsWith(SIN_RESPUESTA)) return { respuesta: SIN_RESPUESTA, fuentes: [] };
  return { respuesta, fuentes: armarFuentes(respuesta, fragmentos, tareas) };
}
