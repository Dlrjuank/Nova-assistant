import { consultar as consultarBd } from '@/lib/db/conexion';
import { recortarEtiqueta } from '@/lib/reglas/citas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { citaDePaginas, MENSAJE_REINDEXAR, MENSAJE_SIN_CAPITULOS } from '@/lib/reglas/libros';
import {
  buscarCapitulo,
  detectarCapitulo,
  detectarPagina,
  esContinuacion,
  etiquetaIncluye,
  FRAGMENTOS_POR_PARTE,
  MENSAJE_ELEGIR_DOCUMENTO,
  TEXTO_CONTINUAR,
  type PedidoCapitulo,
} from '@/lib/reglas/preguntasLibro';
import { capitulosDeDocumento } from './documentos';
import type { Capitulo, Continuacion, Fragmento } from './tipos';

/** Sin `distancia`: se piden por página o capítulo, no por parecido. */
type FilaLibro = Omit<Fragmento, 'distancia'> & { pagina_inicio: number | null; pagina_fin: number | null };

/** Lo que se le entrega al modelo, o la respuesta exacta si no hace falta preguntarle. */
export type PreguntaDeLibro =
  | { tipo: 'fija'; respuesta: string }
  | { tipo: 'contexto'; fragmentos: FilaLibro[]; pregunta: string; fuente?: string; aviso?: string; continuacion?: Continuacion; limitePaginas?: string };

interface DocumentoListo {
  id: string;
  nombre: string;
  paginas: number | null;
}

async function documentosListos(usuarioId: string): Promise<DocumentoListo[]> {
  return consultarBd<DocumentoListo>(
    'SELECT id, nombre_archivo AS nombre, paginas FROM documentos WHERE usuario_id = $1 AND progreso IS NULL AND num_fragmentos > 0 ORDER BY created_at DESC',
    [usuarioId],
  );
}

async function fragmentosDe(usuarioId: string, documentoId: string): Promise<FilaLibro[]> {
  return consultarBd<FilaLibro>(
    `SELECT f.id, f.documento_id, f.numero, f.contenido, d.nombre_archivo, f.etiqueta_paginas, f.pagina_inicio, f.pagina_fin
     FROM fragmentos_pdf f JOIN documentos d ON d.id = f.documento_id
     WHERE d.id = $1 AND d.usuario_id = $2 AND d.progreso IS NULL
     ORDER BY f.numero`,
    [documentoId, usuarioId],
  );
}

/** Los fragmentos que tocan las páginas del capítulo, por partes de hasta FRAGMENTOS_POR_PARTE (RB-40). */
function parteDeCapitulo(todos: FilaLibro[], capitulo: Capitulo, documento: DocumentoListo, desde: number, pregunta: string): PreguntaDeLibro {
  const delCapitulo = todos.filter((f) => f.pagina_inicio !== null && f.pagina_fin !== null && f.pagina_inicio <= capitulo.paginaFin && f.pagina_fin >= capitulo.paginaInicio);
  // Un fragmento puede empezar en la página anterior o terminar en la siguiente: las citas no salen del capítulo.
  const limitePaginas = capitulo.etiquetaPaginas;
  const parte = delCapitulo
    .slice(desde, desde + FRAGMENTOS_POR_PARTE)
    .map((f) => (f.etiqueta_paginas ? { ...f, etiqueta_paginas: recortarEtiqueta(f.etiqueta_paginas, limitePaginas) } : f));
  if (parte.length === 0) return { tipo: 'fija', respuesta: `Ya resumí todo el capítulo «${capitulo.titulo}».` };

  const quedan = desde + parte.length < delCapitulo.length;
  const entero = desde === 0 && !quedan;
  const primera = (parte[0]?.etiqueta_paginas ?? '').split('–')[0] as string;
  const ultima = (parte.at(-1)?.etiqueta_paginas ?? '').split('–').at(-1) as string;
  const rango = entero ? capitulo.etiquetaPaginas : primera === ultima ? primera : `${primera}–${ultima}`;
  return {
    tipo: 'contexto',
    fragmentos: parte,
    pregunta,
    limitePaginas,
    fuente: `${documento.nombre} · ${citaDePaginas(rango)}`,
    ...(quedan
      ? {
          aviso: `El capítulo es largo: resumí las páginas ${rango}. Escribe "${TEXTO_CONTINUAR}" para continuar.`,
          continuacion: { documentoId: documento.id, orden: capitulo.orden, desde: desde + parte.length },
        }
      : {}),
  };
}

async function documentoPedido(usuarioId: string, documentoId: string | undefined): Promise<DocumentoListo | PreguntaDeLibro | null> {
  const listos = await documentosListos(usuarioId);
  if (documentoId) {
    const elegido = listos.find((d) => d.id === documentoId);
    if (!elegido) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
    return elegido.paginas === null ? { tipo: 'fija', respuesta: MENSAJE_REINDEXAR } : elegido;
  }
  const conPaginas = listos.filter((d) => d.paginas !== null);
  if (conPaginas.length > 1) return { tipo: 'fija', respuesta: MENSAJE_ELEGIR_DOCUMENTO };
  return conPaginas[0] ?? null; // sin libros, sigue la consulta normal (RB-32)
}

const nombrePedido = (p: PedidoCapitulo) => (p.tipo === 'numero' ? String(p.numero) : `«${p.titulo}»`);

/**
 * RB-39 y RB-40: si la pregunta es por página o capítulo (o sigue un capítulo por partes), arma el contexto
 * sin búsqueda vectorial. null = no lo es, sigue la consulta normal.
 */
export async function resolverPreguntaDeLibro(
  usuarioId: string,
  pregunta: string,
  opciones: { documentoId?: string | undefined; continuacion?: Continuacion | undefined },
): Promise<PreguntaDeLibro | null> {
  if (opciones.continuacion && esContinuacion(pregunta)) {
    const { documentoId, orden, desde } = opciones.continuacion;
    const { documento, capitulos } = await capitulosDeDocumento(usuarioId, documentoId);
    const capitulo = capitulos.find((c) => c.orden === orden);
    if (!capitulo) return { tipo: 'fija', respuesta: `No encontré el capítulo ${orden} en este documento.` };
    const todos = await fragmentosDe(usuarioId, documentoId);
    return parteDeCapitulo(todos, capitulo, { id: documento.id, nombre: documento.nombreArchivo, paginas: documento.paginas }, desde, `Continúa con el capítulo «${capitulo.titulo}».`);
  }

  const pagina = detectarPagina(pregunta);
  const pedido = pagina === null ? detectarCapitulo(pregunta) : null;
  if (pagina === null && pedido === null) return null;

  const documento = await documentoPedido(usuarioId, opciones.documentoId);
  if (documento === null) return null;
  if ('tipo' in documento) return documento;

  if (pagina !== null) {
    const todos = await fragmentosDe(usuarioId, documento.id);
    const dePagina = todos.filter((f) => f.etiqueta_paginas && etiquetaIncluye(f.etiqueta_paginas, pagina));
    if (dePagina.length === 0) return { tipo: 'fija', respuesta: `Ese documento tiene ${documento.paginas} páginas.` };
    // El texto no dice qué página es: se le indica al modelo, o respondería que no lo encuentra.
    return { tipo: 'contexto', fragmentos: dePagina, pregunta: `Los fragmentos del contexto son de la página ${pagina} del documento. ${pregunta}` };
  }

  const { capitulos } = await capitulosDeDocumento(usuarioId, documento.id);
  if (capitulos.length === 0) return { tipo: 'fija', respuesta: MENSAJE_SIN_CAPITULOS };
  const capitulo = buscarCapitulo(capitulos, pedido as PedidoCapitulo);
  if (!capitulo) return { tipo: 'fija', respuesta: `No encontré el capítulo ${nombrePedido(pedido as PedidoCapitulo)} en este documento.` };
  // El texto no siempre dice de qué capítulo es: se le indica al modelo, o respondería que no lo encuentra.
  return parteDeCapitulo(await fragmentosDe(usuarioId, documento.id), capitulo, documento, 0, `Los fragmentos del contexto son del capítulo «${capitulo.titulo}». ${pregunta}`);
}
