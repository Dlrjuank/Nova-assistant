import { consultar as consultarBd } from '@/lib/db/conexion';
import { recortarEtiqueta } from '@/lib/reglas/citas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { MENSAJE_REINDEXAR, MENSAJE_SIN_CAPITULOS, soloTextoDePagina } from '@/lib/reglas/libros';
import {
  AVISO_PAGINA_APROXIMADA,
  buscarCapitulo,
  detectarCapitulo,
  detectarSeccionPorTitulo,
  detectarUnidad,
  esContinuacion,
  etiquetaIncluye,
  FRAGMENTOS_POR_PARTE,
  MENSAJE_ELEGIR_DOCUMENTO,
  paginaDelPdf,
  TEXTO_CONTINUAR,
  type PedidoCapitulo,
} from '@/lib/reglas/preguntasLibro';
import { citaDeUnidades, contarUnidades, grupoDeUnidad, nombreGrupo, nombreUnidad, type TipoGrupo, type Unidad } from '@/lib/reglas/tiposDocumento';
import { capitulosDeDocumento } from './documentos';
import { COLUMNAS_UNIDAD } from './fragmentos';
import type { Capitulo, Continuacion, Fragmento } from './tipos';

/** Sin `distancia`: se piden por página o capítulo, no por parecido. */
type FilaLibro = Omit<Fragmento, 'distancia'> & { pagina_inicio: number | null; pagina_fin: number | null };

/** Lo que se le entrega al modelo, o la respuesta exacta si no hace falta preguntarle. */
export type PreguntaDeLibro =
  | { tipo: 'fija'; respuesta: string }
  | { tipo: 'contexto'; fragmentos: FilaLibro[]; pregunta: string; fuente?: string; aviso?: string; continuacion?: Continuacion; limitePaginas?: string; paginaPdf?: number };

interface DocumentoListo {
  id: string;
  nombre: string;
  paginas: number | null;
  inicioPaginas?: number[] | null;
  /** E20d: página, sección, diapositiva o parte. */
  unidad: Unidad;
}

async function documentosListos(usuarioId: string): Promise<DocumentoListo[]> {
  const filas = await consultarBd<DocumentoListo>(
    'SELECT id, nombre_archivo AS nombre, paginas, inicio_paginas AS "inicioPaginas", unidad FROM documentos WHERE usuario_id = $1 AND progreso IS NULL AND num_fragmentos > 0 ORDER BY created_at DESC',
    [usuarioId],
  );
  return filas.map((d) => ({ ...d, unidad: d.unidad ?? 'pagina' }));
}

async function fragmentosDe(usuarioId: string, documentoId: string): Promise<FilaLibro[]> {
  return consultarBd<FilaLibro>(
    `SELECT f.id, f.documento_id, f.numero, f.contenido, d.nombre_archivo, f.etiqueta_paginas, f.pagina_inicio, f.pagina_fin, ${COLUMNAS_UNIDAD}
     FROM fragmentos_pdf f JOIN documentos d ON d.id = f.documento_id
     WHERE d.id = $1 AND d.usuario_id = $2 AND d.progreso IS NULL
     ORDER BY f.numero`,
    [documentoId, usuarioId],
  );
}

/** "el capítulo", "la sección", "la diapositiva", "la parte". */
function conArticulo(grupo: TipoGrupo): string {
  return `${grupo === 'capitulo' ? 'el' : 'la'} ${nombreGrupo(grupo)}`;
}

/** Los fragmentos que tocan las páginas del capítulo, por partes de hasta FRAGMENTOS_POR_PARTE (RB-40). */
function parteDeCapitulo(todos: FilaLibro[], capitulo: Capitulo, documento: DocumentoListo, desde: number, pregunta: string): PreguntaDeLibro {
  const grupo: TipoGrupo = capitulo.tipo ?? grupoDeUnidad(documento.unidad);
  const elGrupo = conArticulo(grupo);
  const delCapitulo = todos.filter((f) => f.pagina_inicio !== null && f.pagina_fin !== null && f.pagina_inicio <= capitulo.paginaFin && f.pagina_fin >= capitulo.paginaInicio);
  // Un fragmento puede empezar en la página anterior o terminar en la siguiente: las citas no salen del capítulo.
  // E20d: en un documento por secciones, la cita es el título de la sección pedida.
  const limitePaginas = capitulo.etiquetaPaginas;
  const parte = delCapitulo
    .slice(desde, desde + FRAGMENTOS_POR_PARTE)
    .map((f) => (f.etiqueta_paginas ? { ...f, etiqueta_paginas: recortarEtiqueta(f.etiqueta_paginas, limitePaginas) } : f))
    .map((f) => (documento.unidad === 'seccion' ? { ...f, titulo_unidad: capitulo.titulo } : f));
  if (parte.length === 0) return { tipo: 'fija', respuesta: `Ya resumí ${grupo === 'capitulo' ? 'todo' : 'toda'} ${elGrupo} «${capitulo.titulo}».` };

  const quedan = desde + parte.length < delCapitulo.length;
  const entero = desde === 0 && !quedan;
  const primera = (parte[0]?.etiqueta_paginas ?? '').split('–')[0] as string;
  const ultima = (parte.at(-1)?.etiqueta_paginas ?? '').split('–').at(-1) as string;
  const rango = entero ? capitulo.etiquetaPaginas : primera === ultima ? primera : `${primera}–${ultima}`;
  const cita = documento.unidad === 'seccion' && entero ? capitulo.titulo : citaDeUnidades(rango, documento.unidad === 'seccion' ? 'seccion' : documento.unidad);
  return {
    tipo: 'contexto',
    fragmentos: parte,
    pregunta,
    limitePaginas,
    fuente: `${documento.nombre} · ${cita}`,
    ...(quedan
      ? {
          aviso: `${elGrupo.charAt(0).toUpperCase()}${elGrupo.slice(1)} es ${grupo === 'capitulo' ? 'largo' : 'larga'}: resumí las ${nombreUnidad(documento.unidad, true)} ${rango}. Escribe "${TEXTO_CONTINUAR}" para continuar.`,
          continuacion: { documentoId: documento.id, orden: capitulo.orden, desde: desde + parte.length },
        }
      : {}),
  };
}

/**
 * El documento de la pregunta: el elegido en "Buscar en" o, si no hay, el único que sirve. `sirve` deja fuera los
 * que no tienen la unidad pedida (por ejemplo, "diapositiva 7" no es para un PDF): con el elegido, la pregunta sigue
 * la consulta normal.
 */
async function documentoPedido(usuarioId: string, documentoId: string | undefined, sirve: (d: DocumentoListo) => boolean): Promise<DocumentoListo | PreguntaDeLibro | null> {
  const listos = await documentosListos(usuarioId);
  if (documentoId) {
    const elegido = listos.find((d) => d.id === documentoId);
    if (!elegido) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
    if (elegido.paginas === null) return { tipo: 'fija', respuesta: MENSAJE_REINDEXAR };
    return sirve(elegido) ? elegido : null;
  }
  const conPaginas = listos.filter((d) => d.paginas !== null && sirve(d));
  if (conPaginas.length > 1) return { tipo: 'fija', respuesta: MENSAJE_ELEGIR_DOCUMENTO };
  return conPaginas[0] ?? null; // sin libros, sigue la consulta normal (RB-32)
}

const nombrePedido = (p: PedidoCapitulo) => (p.tipo === 'numero' ? String(p.numero) : `«${p.titulo}»`);

/**
 * RB-39 y RB-40: si la pregunta es por página o capítulo (o sigue un capítulo por partes), arma el contexto
 * sin búsqueda vectorial. null = no lo es, sigue la consulta normal.
 * E20d: también por diapositiva, parte o sección (número o título), en los documentos de esa unidad.
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
    if (!capitulo) return { tipo: 'fija', respuesta: `No encontré ${conArticulo(grupoDeUnidad(documento.unidad ?? 'pagina'))} ${orden} en este documento.` };
    const todos = await fragmentosDe(usuarioId, documentoId);
    return parteDeCapitulo(
      todos,
      capitulo,
      { id: documento.id, nombre: documento.nombreArchivo, paginas: documento.paginas, unidad: documento.unidad ?? 'pagina' },
      desde,
      `Continúa con ${conArticulo(capitulo.tipo ?? grupoDeUnidad(documento.unidad ?? 'pagina'))} «${capitulo.titulo}».`,
    );
  }

  const unidadPedida = detectarUnidad(pregunta);
  const pedido = unidadPedida === null ? detectarCapitulo(pregunta) : null;
  const seccionPedida = unidadPedida === null && pedido === null ? detectarSeccionPorTitulo(pregunta) : null;
  if (unidadPedida === null && pedido === null && seccionPedida === null) return null;

  // "página N" vale en cualquier documento (en uno que no es PDF, es su unidad N); las demás, solo en los de esa unidad.
  const sirve = (d: DocumentoListo) =>
    unidadPedida ? unidadPedida.unidad === 'pagina' || unidadPedida.unidad === d.unidad : seccionPedida !== null ? d.unidad === 'seccion' : true;
  const documento = await documentoPedido(usuarioId, opciones.documentoId, sirve);
  if (documento === null) return null;
  if ('tipo' in documento) return documento;

  if (unidadPedida !== null) {
    const pagina = unidadPedida.numero;
    const unidad = documento.unidad;
    const palabra = nombreUnidad(unidad);
    const todos = await fragmentosDe(usuarioId, documento.id);
    const dePagina = todos.filter((f) => f.etiqueta_paginas && etiquetaIncluye(f.etiqueta_paginas, pagina));
    if (dePagina.length === 0) return { tipo: 'fija', respuesta: `Ese documento tiene ${contarUnidades(documento.paginas ?? 0, unidad)}.` };
    const etiqueta = String(pagina);
    // E20d: la sección pedida se cita por su título.
    const titulo = unidad === 'seccion' ? tituloDeSeccion((await capitulosDeDocumento(usuarioId, documento.id)).capitulos, pagina) : null;
    const conEtiqueta = <T extends FilaLibro>(f: T): T => ({ ...f, etiqueta_paginas: etiqueta, titulo_unidad: titulo });
    // El texto no dice qué página es: se le indica al modelo, o respondería que no lo encuentra.
    const preguntaConPagina = `Los fragmentos del contexto son de la ${palabra} ${pagina}${titulo ? ` («${titulo}»)` : ''} del documento. ${pregunta}`;
    const paginaPdf = paginaDelPdf(dePagina[0] as FilaLibro, pagina);
    if (documento.inicioPaginas && paginaPdf !== null) {
      const soloEsa = soloTextoDePagina(dePagina, paginaPdf, documento.inicioPaginas).map(conEtiqueta);
      if (soloEsa.length === 0) return { tipo: 'fija', respuesta: `La ${palabra} ${pagina} no tiene texto.` };
      return { tipo: 'contexto', fragmentos: soloEsa, pregunta: preguntaConPagina, limitePaginas: etiqueta, paginaPdf };
    }
    // Indexado antes de guardar dónde empieza cada página: la cita se limita, y se avisa que el texto puede ser de las vecinas.
    return { tipo: 'contexto', fragmentos: dePagina.map(conEtiqueta), pregunta: preguntaConPagina, limitePaginas: etiqueta, aviso: AVISO_PAGINA_APROXIMADA };
  }

  const { capitulos } = await capitulosDeDocumento(usuarioId, documento.id);
  if (capitulos.length === 0) return { tipo: 'fija', respuesta: MENSAJE_SIN_CAPITULOS };
  const buscado: PedidoCapitulo = seccionPedida !== null ? { tipo: 'titulo', titulo: seccionPedida } : (pedido as PedidoCapitulo);
  const capitulo = buscarCapitulo(capitulos, buscado);
  if (!capitulo) return { tipo: 'fija', respuesta: `No encontré ${conArticulo(grupoDeUnidad(documento.unidad))} ${nombrePedido(buscado)} en este documento.` };
  // El texto no siempre dice de qué capítulo es: se le indica al modelo, o respondería que no lo encuentra.
  return parteDeCapitulo(
    await fragmentosDe(usuarioId, documento.id),
    capitulo,
    documento,
    0,
    `Los fragmentos del contexto son ${conArticulo(capitulo.tipo ?? grupoDeUnidad(documento.unidad)).replace(/^el /, 'del ').replace(/^la /, 'de la ')} «${capitulo.titulo}». ${pregunta}`,
  );
}

/** E20d: el título de la sección que empieza en la unidad pedida (la más profunda), o null. */
function tituloDeSeccion(capitulos: readonly Capitulo[], unidad: number): string | null {
  const empiezan = capitulos.filter((c) => c.paginaInicio === unidad).sort((a, b) => b.nivel - a.nivel);
  return empiezan[0]?.titulo ?? null;
}
