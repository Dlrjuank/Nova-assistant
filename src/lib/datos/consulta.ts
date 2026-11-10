import { FRAGMENTOS_RECUPERADOS } from '@/lib/config/nova';
import { llm } from '@/lib/llm/gemini';
import {
  construirContexto,
  etiquetaFragmento,
  etiquetaTarea,
  SIN_DOCUMENTOS_RESPUESTA,
  SIN_RESPUESTA,
  SIN_TAREAS_PENDIENTES,
  sinRespuestaEnDocumento,
  SYSTEM_PROMPT,
  type FragmentoContexto,
  type TareaContexto,
  type TurnoConversacion,
} from '@/lib/llm/prompts';
import { citaCorta, compactarCitas } from '@/lib/reglas/citas';
import { mencionaTareas, normalizarConsulta, textoDeBusqueda, validarConsulta } from '@/lib/reglas/consulta';
import { lineaHoy } from '@/lib/reglas/fechas';
import { existenDocumentos } from './documentos';
import { resolverPreguntaDeLibro } from './consultaLibro';
import { recuperarFragmentos, recuperarFragmentosDeDocumento } from './fragmentos';
import { tareasPendientesComoTexto } from './tareas';
import type { Continuacion, Fragmento, Fuente, RespuestaAsistente } from './tipos';

/**
 * RN-14: fuentes usadas. Se recuperan siempre 4 fragmentos, aunque no todos sirvan, así que se dejan
 * las que el modelo citó; si no citó ninguna por su etiqueta, se devuelven todas las entregadas.
 */
export function armarFuentes(
  respuesta: string,
  fragmentos: FragmentoContexto[],
  tareas: TareaContexto[],
): Fuente[] {
  // RB-36: dos fragmentos de la misma página tienen la misma etiqueta; la fuente se muestra una vez.
  const etiquetas = [...new Set(fragmentos.map(etiquetaFragmento))];
  const entregadas: Fuente[] = [
    ...etiquetas.map((etiqueta): Fuente => ({ tipo: 'pdf', etiqueta })),
    ...tareas.map((t): Fuente => ({ tipo: 'tarea', etiqueta: etiquetaTarea(t.id) })),
  ];
  // El modelo a veces cambia la raya de "pp. 45–46" por un guion.
  const sinRaya = (texto: string) => texto.replaceAll('–', '-');
  const citada = sinRaya(respuesta);
  // Sin el lookahead, "fragmento 1" también coincidiría dentro de "fragmento 12".
  const escapar = (t: string) => sinRaya(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const citadas = entregadas.filter((f) => {
    // También la forma corta "[p. 20]": el modelo puede imitarla de las respuestas anteriores.
    const corta = f.tipo === 'pdf' ? citaCorta(f.etiqueta) : null;
    return new RegExp(`${escapar(f.etiqueta)}(?!\\d)`).test(citada) || (corta !== null && citada.includes(sinRaya(corta)));
  });
  return citadas.length > 0 ? citadas : entregadas;
}

/** CU-03, secuencia de la sección 7.1. `historial`: los últimos mensajes de la conversación (RN-21). */
export async function consultar(
  usuarioId: string,
  pregunta: string,
  historial: TurnoConversacion[] = [],
  opciones: { documentoId?: string | undefined; continuacion?: Continuacion | undefined } = {},
): Promise<RespuestaAsistente> {
  validarConsulta(pregunta); // RN-02
  const preguntaNormal = normalizarConsulta(pregunta);

  // E10c (RB-39, RB-40): por página o capítulo se responde con ese texto, sin búsqueda vectorial.
  const libro = await resolverPreguntaDeLibro(usuarioId, preguntaNormal, opciones);
  if (libro?.tipo === 'fija') return { respuesta: libro.respuesta, fuentes: [] };
  if (libro) {
    const texto = await llm.responder({
      sistema: SYSTEM_PROMPT,
      contexto: construirContexto(libro.fragmentos, [], lineaHoy(), { tareasConsultadas: false, hayDocumentos: true }),
      pregunta: libro.pregunta,
      historial,
    });
    if (texto.startsWith(SIN_RESPUESTA)) {
      const nombre = opciones.documentoId ? libro.fragmentos[0]?.nombre_archivo : undefined;
      return { respuesta: nombre ? sinRespuestaEnDocumento(nombre) : SIN_RESPUESTA, fuentes: [] };
    }
    const corto = compactarCitas(texto, { limite: libro.limitePaginas }); // RB-36
    return {
      respuesta: libro.aviso ? `${corto}\n\n${libro.aviso}` : corto,
      fuentes: libro.fuente ? [{ tipo: 'pdf', etiqueta: libro.fuente }] : armarFuentes(texto, libro.fragmentos, []),
      contexto: {
        fragmentos: libro.fragmentos.map((f) => f.id),
        ...(libro.continuacion ? { continuacion: libro.continuacion } : {}),
        ...(libro.limitePaginas ? { limitePaginas: libro.limitePaginas } : {}),
        ...(libro.paginaPdf ? { paginaPdf: libro.paginaPdf } : {}),
      },
    };
  }

  const anterior = historial.findLast((m) => m.autor === 'usuario')?.texto;
  const busqueda = textoDeBusqueda(preguntaNormal, anterior); // RN-21

  // RB-32 (reemplaza a RN-15 y al último caso de RB-30): la consulta nunca se bloquea por falta de documentos.
  const hayDocumentos = await existenDocumentos(usuarioId);
  let fragmentos: Fragmento[] = [];
  if (hayDocumentos) {
    const vector = await llm.generarEmbedding(busqueda);
    fragmentos = opciones.documentoId
      ? await recuperarFragmentosDeDocumento(usuarioId, vector, FRAGMENTOS_RECUPERADOS, opciones.documentoId) // E10c: "Buscar en"
      : await recuperarFragmentos(usuarioId, vector, FRAGMENTOS_RECUPERADOS); // RN-12
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
    const elegido = opciones.documentoId ? fragmentos[0]?.nombre_archivo : undefined;
    if (elegido) return { respuesta: sinRespuestaEnDocumento(elegido), fuentes: [] };
    return { respuesta: hayDocumentos ? SIN_RESPUESTA : SIN_DOCUMENTOS_RESPUESTA, fuentes: [] };
  }
  const fuentes = armarFuentes(respuesta, fragmentos, tareas);
  // RB-41: solo las respuestas que citan documentos se pueden explicar de otra manera.
  return { respuesta: compactarCitas(respuesta), fuentes, ...(fuentes.some((f) => f.tipo === 'pdf') ? { contexto: { fragmentos: fragmentos.map((f) => f.id) } } : {}) };
}
