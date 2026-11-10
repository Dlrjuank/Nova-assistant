import { FRAGMENTOS_RECUPERADOS } from '@/lib/config/nova';
import { consultar } from '@/lib/db/conexion';
import { llm } from '@/lib/llm/gemini';
import { SIN_FUENTES_WEB, SIN_RESPUESTA_FUENTES_WEB, SYSTEM_PROMPT_FUENTES_WEB, type TurnoConversacion } from '@/lib/llm/prompts';
import { normalizarConsulta, textoDeBusqueda, validarConsulta } from '@/lib/reglas/consulta';
import { etiquetaFuenteWeb, fuentesCitadas } from '@/lib/reglas/fuentesWeb';
import type { Fuente, RespuestaAsistente } from './tipos';
import { buscarEnWikipedia } from './wikipedia';

const MAX_POR_VECTORIZAR = 20; // cabe en una sola llamada a Gemini y en el tiempo de la ruta

/** RB-58: el resumen de Wikipedia con sus artículos. No usa documentos ni tareas. */
export async function responderConWikipedia(pregunta: string): Promise<RespuestaAsistente> {
  const { resumen, articulos } = await buscarEnWikipedia(pregunta);
  return { respuesta: resumen, fuentes: articulos.map((a): Fuente => ({ tipo: 'web', etiqueta: `${a.titulo} · Wikipedia`, url: a.url })) };
}

/** M18: las fuentes guardadas antes de E10c2, o sin vector porque Gemini falló al guardarlas. */
async function vectorizarPendientes(usuarioId: string): Promise<void> {
  const pendientes = await consultar<{ id: string; extracto: string }>(
    'SELECT id, extracto FROM fuentes_web WHERE usuario_id = $1 AND vector IS NULL ORDER BY created_at LIMIT $2',
    [usuarioId, MAX_POR_VECTORIZAR],
  );
  if (pendientes.length === 0) return;
  const vectores = await llm.generarEmbeddings(pendientes.map((f) => f.extracto), { interactivo: true });
  await Promise.all(
    pendientes.map((f, i) =>
      consultar('UPDATE fuentes_web SET vector = $1::vector WHERE id = $2 AND usuario_id = $3', [JSON.stringify(vectores[i]), f.id, usuarioId]),
    ),
  );
}

/** RB-56: responde solo con las fuentes web guardadas del usuario y las cita con su enlace. */
export async function responderConFuentesWeb(usuarioId: string, pregunta: string, historial: TurnoConversacion[] = []): Promise<RespuestaAsistente> {
  validarConsulta(pregunta); // RN-02
  const preguntaNormal = normalizarConsulta(pregunta);
  const [cuenta] = await consultar<{ n: number }>('SELECT COUNT(*)::int AS n FROM fuentes_web WHERE usuario_id = $1', [usuarioId]);
  if ((cuenta?.n ?? 0) === 0) return { respuesta: SIN_FUENTES_WEB, fuentes: [] };

  await vectorizarPendientes(usuarioId);
  const anterior = historial.findLast((m) => m.autor === 'usuario')?.texto;
  const vector = await llm.generarEmbedding(textoDeBusqueda(preguntaNormal, anterior));
  const halladas = await consultar<{ url: string; extracto: string }>('SELECT url, extracto FROM buscar_fuentes_web_usuario($1::vector, $2, $3)', [
    JSON.stringify(vector),
    FRAGMENTOS_RECUPERADOS,
    usuarioId,
  ]);
  const entregadas = halladas.map((f): Fuente => ({ tipo: 'web', etiqueta: etiquetaFuenteWeb(f.url), url: f.url }));
  const respuesta = await llm.responder({
    sistema: SYSTEM_PROMPT_FUENTES_WEB,
    contexto: `FUENTES WEB GUARDADAS:\n\n${halladas.map((f, i) => `[${entregadas[i]?.etiqueta}]\n${f.extracto}`).join('\n\n')}`,
    pregunta: preguntaNormal,
    historial,
  });
  // El historial puede traer el texto anterior y el modelo a veces recorta el nuevo: el servidor impone el exacto.
  if (respuesta.startsWith('No encontré esto')) return { respuesta: SIN_RESPUESTA_FUENTES_WEB, fuentes: [] };
  return { respuesta, fuentes: fuentesCitadas(respuesta, entregadas) };
}
