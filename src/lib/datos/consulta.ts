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
} from '@/lib/llm/prompts';
import { mencionaTareas, normalizarConsulta, validarConsulta } from '@/lib/reglas/consulta';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { existenDocumentos } from './documentos';
import { recuperarFragmentos } from './fragmentos';
import { tareasPendientesComoTexto } from './tareas';
import type { Fuente, RespuestaAsistente } from './tipos';

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

/** CU-03, secuencia de la sección 7.1. */
export async function consultar(pregunta: string): Promise<RespuestaAsistente> {
  validarConsulta(pregunta); // RN-02
  if (!(await existenDocumentos())) throw new ErrorDeNegocio('SIN_DOCUMENTOS'); // RN-15

  const preguntaNormal = normalizarConsulta(pregunta);
  const vector = await llm.generarEmbedding(preguntaNormal);
  const fragmentos = await recuperarFragmentos(vector, FRAGMENTOS_RECUPERADOS); // RN-12
  const tareas = mencionaTareas(preguntaNormal) ? await tareasPendientesComoTexto() : []; // RN-12

  const respuesta = await llm.responder({
    sistema: SYSTEM_PROMPT,
    contexto: construirContexto(fragmentos, tareas),
    pregunta: preguntaNormal,
  }); // RN-13

  // Sin respuesta en el contexto: mensaje exacto de la sección 5.1 y ninguna fuente.
  if (respuesta.startsWith(SIN_RESPUESTA)) return { respuesta: SIN_RESPUESTA, fuentes: [] };
  return { respuesta, fuentes: armarFuentes(respuesta, fragmentos, tareas) };
}
