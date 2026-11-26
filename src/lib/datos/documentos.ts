import { del } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { CATEGORIA_POR_DEFECTO, INDEXACION_LOTE, INDEXACION_PRESUPUESTO_MS, LIMITE_LISTADO, PDF_MAX_BYTES } from '@/lib/config/nova';
import { aLiteralVector, conTransaccion, consultar } from '@/lib/db/conexion';
import { llm } from '@/lib/llm/gemini';
import { extraerPdf, type PdfExtraido } from '@/lib/pdf/extraer';
import { seccionesMarkdown, partesDeTexto, decodificarTexto } from '@/lib/lectores/texto';
import { leerDocx, leerPptx } from '@/lib/lectores/office';
import { EXTENSIONES_ADMITIDAS, extensionDe, tipoDeArchivo, TIPOS_MIME_ADMITIDOS, type EstructuraDocumento, type GrupoDocumento, type TipoDocumento } from '@/lib/reglas/tiposDocumento';
import { validarTamanoPdf, validarTextoExtraido } from '@/lib/reglas/documento';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import type { EtapaServidor } from '@/lib/reglas/etapasIndexacion';
import { hoyBogota } from '@/lib/reglas/fechas';
import { detectarCapitulos, fragmentarPaginas, inicioDePaginas, soloTextoDePagina, validarPaginas, type FragmentoLibro } from '@/lib/reglas/libros';
import type { Capitulo, CapitulosDocumento, Documento, EstadoOcr, ResultadoIndexacion } from './tipos';
import { conIaDe } from '@/lib/llm/contextoIa';
import { descargarArchivo } from './descargas';
import { borrarArchivosOcr, leerGrupoOcr } from './ocr';
import {
  DIAS_LECTURA_SIN_AVANCE,
  esLecturaOcr,
  hayTexto,
  HORAS_PREGUNTA_OCR,
  MINUTOS_ESPERA_TRAS_FALLO,
  OCR_MAX_FALLOS,
  OCR_MAX_FOTOS,
  OCR_MAX_PAGINAS,
  type LecturaOcr,
} from '@/lib/reglas/ocr';
import type { PoolClient } from 'pg';

/**
 * Protocolo de subida client-side de Vercel Blob; devuelve lo que espera upload() en el navegador.
 * Sin onUploadCompleted no se registra webhook, así que la ruta puede exigir sesión en todas sus llamadas.
 */
export async function emitirTokenSubida(cuerpo: HandleUploadBody, peticion: Request) {
  return handleUpload({
    body: cuerpo,
    request: peticion,
    onBeforeGenerateToken: async (ruta) => {
      // E20d: PDF, Word, PowerPoint, Markdown y texto.
      if (!EXTENSIONES_ADMITIDAS.includes(extensionDe(ruta))) throw new ErrorDeNegocio('TIPO_NO_ADMITIDO');
      return {
        allowedContentTypes: TIPOS_MIME_ADMITIDOS,
        maximumSizeInBytes: PDF_MAX_BYTES,
        addRandomSuffix: true,
      };
    },
  });
}

/** RB-38: lo que falta por indexar; se guarda en la base para poder reanudar. */
type Pendiente = FragmentoLibro;

const LEASE_MINUTOS = 6; // más que el maxDuration de la ruta: si la función muere, otra llamada puede retomar

/**
 * RB-38: vectoriza y guarda de a un lote hasta terminar o agotar el presupuesto. Cada lote queda guardado
 * antes de seguir, así que un corte solo pierde el lote en curso. Devuelve el progreso (null = terminado).
 */
async function avanzarIndexacion(
  documentoId: string,
  iniciales: Pendiente[],
  presupuestoMs: number,
  opcionesEmbeddings: { sinEsperarCuota?: boolean } = {},
  alEtapa: (etapa: EtapaServidor) => void = () => {},
): Promise<number | null> {
  const limite = Date.now() + presupuestoMs;
  const hechosAntes = (iniciales[0]?.numero ?? 1) - 1;
  const total = hechosAntes + iniciales.length;
  let pendientes = iniciales;
  let guardadosAhora = 0;
  try {
    while (pendientes.length > 0) {
      if (guardadosAhora > 0 && Date.now() >= limite) break;
      const lote = pendientes.slice(0, INDEXACION_LOTE);
      let vectores: number[][];
      try {
        // Los embeddings van antes de la transacción para no retener una conexión durante las llamadas a Gemini.
        alEtapa('vectores'); // E20b: etapa visible
        vectores = await llm.generarEmbeddings(lote.map((f) => f.contenido), opcionesEmbeddings);
      } catch (error) {
        // Sin cuota por ahora, pero ya se avanzó: se conserva y se sigue en la próxima llamada.
        if (guardadosAhora > 0 && error instanceof ErrorDeNegocio && error.codigo === 'ERROR_LLM') break;
        throw error;
      }
      const resto = pendientes.slice(lote.length);
      alEtapa('guardar');
      const existe = await conTransaccion(async (tx) => {
        // Si lo eliminaron mientras se indexaba, no hay nada que guardar.
        const { rows } = await tx.query('SELECT 1 FROM documentos WHERE id = $1 FOR UPDATE', [documentoId]);
        if (rows.length === 0) return false;
        await tx.query(
          `INSERT INTO fragmentos_pdf (documento_id, numero, contenido, vector, pagina_inicio, pagina_fin, etiqueta_paginas, ocr)
           SELECT $1, t.numero, t.contenido, t.vector::vector, t.inicio, t.fin, t.etiqueta, t.ocr
           FROM unnest($2::int[], $3::text[], $4::text[], $5::smallint[], $6::smallint[], $7::text[], $8::bool[])
             AS t(numero, contenido, vector, inicio, fin, etiqueta, ocr)
           ON CONFLICT (documento_id, numero) DO NOTHING`,
          [
            documentoId,
            lote.map((f) => f.numero),
            lote.map((f) => f.contenido),
            vectores.map(aLiteralVector),
            lote.map((f) => f.paginaInicio),
            lote.map((f) => f.paginaFin),
            lote.map((f) => f.etiquetaPaginas),
            lote.map((f) => f.ocr === true),
          ],
        );
        if (resto.length > 0) {
          await tx.query('UPDATE documentos SET por_indexar = $2::jsonb, progreso = $3 WHERE id = $1', [
            documentoId,
            JSON.stringify(resto),
            Math.min(99, Math.floor(((total - resto.length) / total) * 100)),
          ]);
        } else {
          await tx.query('UPDATE documentos SET por_indexar = NULL, progreso = NULL, num_fragmentos = $2 WHERE id = $1', [documentoId, total]);
        }
        return true;
      });
      if (!existe) return null;
      pendientes = resto;
      guardadosAhora += lote.length;
    }
    return pendientes.length === 0 ? null : Math.min(99, Math.floor(((total - pendientes.length) / total) * 100));
  } finally {
    await consultar('UPDATE documentos SET indexando_hasta = NULL WHERE id = $1', [documentoId]).catch(() => {});
  }
}

/** E20d: el texto de cada unidad y sus grupos, según el tipo. */
async function leerEstructura(tipo: TipoDocumento, contenido: Uint8Array): Promise<EstructuraDocumento> {
  if (tipo === 'md') return seccionesMarkdown(decodificarTexto(contenido));
  if (tipo === 'txt') return partesDeTexto(decodificarTexto(contenido));
  if (tipo === 'docx') return leerDocx(contenido); // E20d-2
  if (tipo === 'pptx') return leerPptx(contenido);
  const extraido = await extraerPdf(contenido);
  const paginas = paginasSinNul(extraido);
  validarPaginas(paginas.length); // RB-38
  return estructuraDePdf(paginas, extraido);
}

/** Postgres no admite el carácter NUL en columnas de texto y algunos PDF lo incluyen. */
const paginasSinNul = (extraido: Pick<PdfExtraido, 'paginas'>) => extraido.paginas.map((p) => p.replaceAll('\u0000', ' '));

/** Un PDF por páginas, con sus capítulos (RB-37). Sin texto en ninguna página, PDF_SIN_TEXTO. */
function estructuraDePdf(paginas: string[], extraido: Pick<PdfExtraido, 'indice' | 'etiquetas'>): EstructuraDocumento {
  validarTextoExtraido(paginas.join(' '));
  return { unidad: 'pagina', unidades: paginas, etiquetas: extraido.etiquetas, grupos: capitulosDePdf(paginas, extraido) };
}

const capitulosDePdf = (paginas: readonly string[], extraido: Pick<PdfExtraido, 'indice' | 'etiquetas'>): GrupoDocumento[] =>
  detectarCapitulos(paginas, extraido.indice, extraido.etiquetas).map((c) => ({ ...c, tipo: 'capitulo' as const }));

async function insertarCapitulos(tx: PoolClient, documentoId: string, usuarioId: string, capitulos: readonly GrupoDocumento[]): Promise<void> {
  if (capitulos.length === 0) return;
  await tx.query(
    `INSERT INTO capitulos (documento_id, usuario_id, orden, nivel, titulo, pagina_inicio, pagina_fin, etiqueta_paginas, tipo)
     SELECT $1, $2, t.orden, t.nivel, t.titulo, t.inicio, t.fin, t.etiqueta, t.tipo
     FROM unnest($3::smallint[], $4::smallint[], $5::text[], $6::smallint[], $7::smallint[], $8::text[], $9::text[])
       AS t(orden, nivel, titulo, inicio, fin, etiqueta, tipo)`,
    [
      documentoId,
      usuarioId,
      capitulos.map((c) => c.orden),
      capitulos.map((c) => c.nivel),
      capitulos.map((c) => c.titulo),
      capitulos.map((c) => c.paginaInicio),
      capitulos.map((c) => c.paginaFin),
      capitulos.map((c) => c.etiquetaPaginas),
      capitulos.map((c) => c.tipo),
    ],
  );
}

/**
 * Valida, fragmenta por páginas y empieza a indexar un PDF ya descargado. Los libros largos siguen por partes
 * con continuarIndexacion (RB-38). Se exporta para los scripts, que indexan sin pasar por Blob; dataService no lo expone.
 */
export async function indexarContenido(
  usuarioId: string,
  contenido: Uint8Array,
  d: { nombreArchivo: string; categoria?: string | undefined; materiaId?: string | undefined; urlBlob?: string | undefined },
  opciones: { presupuestoMs?: number; alEtapa?: ((etapa: EtapaServidor) => void) | undefined } = {},
): Promise<ResultadoIndexacion> {
  const alEtapa = opciones.alEtapa ?? (() => {});
  const categoria = await categoriaDe(usuarioId, d);
  validarTamanoPdf(contenido.length);
  // E20d: el tipo sale de la extensión del nombre (la subida ya solo admite esas).
  const tipo = tipoDeArchivo(d.nombreArchivo);
  if (!tipo) throw new ErrorDeNegocio('TIPO_NO_ADMITIDO');
  let estructura: EstructuraDocumento;
  if (tipo === 'pdf') {
    const extraido = await extraerPdf(contenido);
    const paginasPdf = paginasSinNul(extraido);
    validarPaginas(paginasPdf.length); // RB-38
    // E20d-3: con páginas escaneadas, se guarda lo leído y se pregunta antes de gastar consultas. Sin la dirección del
    // archivo en Blob (los scripts) no se podrían leer después: se indexa como antes.
    if (d.urlBlob && extraido.escaneadas.length > 0) {
      if (extraido.escaneadas.length > OCR_MAX_PAGINAS) {
        throw new ErrorDeNegocio('PDF_MUY_LARGO', `El PDF tiene ${extraido.escaneadas.length} páginas escaneadas; el máximo es ${OCR_MAX_PAGINAS}.`);
      }
      return crearLecturaOcr(usuarioId, { nombreArchivo: d.nombreArchivo, categoria, materiaId: d.materiaId }, {
        fuente: 'pdf',
        urls: [d.urlBlob],
        textos: paginasPdf,
        porLeer: extraido.escaneadas,
        etiquetas: extraido.etiquetas,
        indice: extraido.indice,
      });
    }
    estructura = estructuraDePdf(paginasPdf, extraido);
  } else {
    estructura = await leerEstructura(tipo, contenido);
  }
  const { unidad, unidades: paginas, etiquetas, grupos: capitulos } = estructura;

  alEtapa('dividir');
  const fragmentos = fragmentarPaginas(paginas, etiquetas);

  const documentoId = await conTransaccion(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO documentos
         (nombre_archivo, categoria, num_fragmentos, fecha_guardado, usuario_id, paginas, progreso, por_indexar, indexando_hasta, inicio_paginas, materia_id, tipo, unidad)
       VALUES ($1, $2, 0, $3, $4, $5, 0, $6::jsonb, NOW() + make_interval(mins => $7), $8::int[], $9, $10, $11) RETURNING id`,
      [d.nombreArchivo, categoria, hoyBogota(), usuarioId, paginas.length, JSON.stringify(fragmentos), LEASE_MINUTOS, inicioDePaginas(paginas), d.materiaId ?? null, tipo, unidad],
    );
    const id = (rows[0] as { id: string }).id;
    await insertarCapitulos(tx, id, usuarioId, capitulos);
    return id;
  });

  try {
    const progreso = await avanzarIndexacion(documentoId, fragmentos, opciones.presupuestoMs ?? INDEXACION_PRESUPUESTO_MS, {}, alEtapa);
    return { documentoId, numFragmentos: fragmentos.length, progreso };
  } catch (error) {
    // Si falla antes de guardar nada, como antes de E10b: no queda un documento a medias.
    await consultar('DELETE FROM documentos WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM fragmentos_pdf WHERE documento_id = $1)', [documentoId]).catch(() => {});
    throw error;
  }
}

/** E20d-4: un documento con una o varias fotos (una por página); pregunta antes de leerlas con OCR. */
async function iniciarFotos(
  usuarioId: string,
  d: { urls: string[]; nombreArchivo: string; categoria?: string | undefined; materiaId?: string | undefined },
): Promise<ResultadoIndexacion> {
  if (!d.urls.every((u) => tipoDeArchivo(new URL(u).pathname) === 'imagen')) {
    throw new ErrorDeNegocio('TIPO_NO_ADMITIDO', 'Solo las fotos se pueden subir varias juntas.');
  }
  if (d.urls.length > OCR_MAX_FOTOS) throw new ErrorDeNegocio('PDF_MUY_LARGO', `Puedes subir hasta ${OCR_MAX_FOTOS} fotos en un documento.`);
  const categoria = await categoriaDe(usuarioId, d);
  return crearLecturaOcr(usuarioId, { nombreArchivo: d.nombreArchivo, categoria, materiaId: d.materiaId }, {
    fuente: 'fotos',
    urls: d.urls,
    textos: d.urls.map(() => ''),
    porLeer: d.urls.map((_, i) => i + 1),
    etiquetas: null,
    indice: [],
  });
}

/** E13 (B-21): con una materia del usuario, su nombre es la categoría; una ajena responde como inexistente. */
async function categoriaDe(usuarioId: string, d: { categoria?: string | undefined; materiaId?: string | undefined }): Promise<string> {
  if (!d.materiaId) return d.categoria?.trim() || CATEGORIA_POR_DEFECTO;
  const [materia] = await consultar<{ nombre: string }>('SELECT nombre FROM materias WHERE id = $1 AND usuario_id = $2', [d.materiaId, usuarioId]);
  if (!materia) throw new ErrorDeNegocio('MATERIA_NO_ENCONTRADA');
  return materia.nombre;
}

// ---------------------------------------------------------------- E20d-3 y E20d-4: lectura con OCR

/** La lectura con OCR se guarda en `por_indexar` como un objeto (lo normal es la lista de fragmentos). */
const ES_LECTURA = "jsonb_typeof(por_indexar) = 'object'";
const ESPERA_RESPUESTA = `(${ES_LECTURA} AND por_indexar->>'estado' = 'pregunta')`;

const estadoDe = (l: LecturaOcr): EstadoOcr => ({ estado: l.estado, fuente: l.fuente, total: l.total, leidas: l.leidas.length });

/** Crea el documento con lo ya leído y la pregunta pendiente; no indexa nada todavía. */
async function crearLecturaOcr(
  usuarioId: string,
  d: { nombreArchivo: string; categoria: string; materiaId?: string | undefined },
  parcial: Pick<LecturaOcr, 'fuente' | 'urls' | 'textos' | 'porLeer' | 'etiquetas' | 'indice'>,
): Promise<ResultadoIndexacion> {
  const lectura: LecturaOcr = {
    ocr: true,
    estado: 'pregunta',
    ...parcial,
    leidas: [],
    total: parcial.porLeer.length,
    venceEn: new Date(Date.now() + HORAS_PREGUNTA_OCR * 3_600_000).toISOString(),
  };
  const [fila] = await consultar<{ id: string }>(
    `INSERT INTO documentos (nombre_archivo, categoria, num_fragmentos, fecha_guardado, usuario_id, paginas, progreso, por_indexar, materia_id, tipo, unidad)
     VALUES ($1, $2, 0, $3, $4, $5, 0, $6::jsonb, $7, $8, 'pagina') RETURNING id`,
    [d.nombreArchivo, d.categoria, hoyBogota(), usuarioId, lectura.textos.length, JSON.stringify(lectura), d.materiaId ?? null, lectura.fuente === 'pdf' ? 'pdf' : 'imagen'],
  );
  return { documentoId: (fila as { id: string }).id, numFragmentos: 0, progreso: 0, ocr: estadoDe(lectura) };
}

/**
 * Termina la lectura: con lo que haya (leído o no), arma los fragmentos y los capítulos y deja el documento listo
 * para crear los vectores por partes. Sin texto en ninguna página, el documento se borra. Los archivos se borran de
 * Blob en los dos casos. `eliminado`: no quedó nada que guardar.
 */
async function terminarLectura(id: string, lectura: LecturaOcr, opciones: { soloSiPregunta?: boolean } = {}): Promise<{ progreso: number | null; eliminado?: boolean }> {
  // "Ahora no" y el vencimiento solo terminan si sigue esperando la respuesta: si otra pestaña ya respondió "Leerlas",
  // no se corta su lectura.
  const cual = opciones.soloSiPregunta ? ESPERA_RESPUESTA : ES_LECTURA;
  const textos = lectura.textos.map((t) => t.replaceAll('\u0000', ' '));
  if (!hayTexto(textos)) {
    const borrados = await consultar<{ id: string }>(`DELETE FROM documentos WHERE id = $1 AND ${cual} RETURNING id`, [id]);
    if (borrados.length === 0 && opciones.soloSiPregunta) return { progreso: 0 };
    await borrarArchivosOcr(lectura.urls);
    return { progreso: null, eliminado: true };
  }
  const leidas = new Set(lectura.leidas);
  const fragmentos = fragmentarPaginas(textos, lectura.etiquetas, leidas);
  const capitulos = lectura.fuente === 'pdf' ? capitulosDePdf(textos, lectura) : [];
  const tipo: TipoDocumento = leidas.size === 0 ? 'pdf' : lectura.fuente === 'pdf' ? 'pdf_escaneado' : 'imagen';
  const sigue = await conTransaccion(async (tx) => {
    const { rows } = await tx.query<{ usuario_id: string }>(`SELECT usuario_id FROM documentos WHERE id = $1 AND ${cual} FOR UPDATE`, [id]);
    const fila = rows[0];
    if (!fila) return false; // lo eliminaron o ya se terminó
    await insertarCapitulos(tx, id, fila.usuario_id, capitulos);
    await tx.query(
      `UPDATE documentos SET por_indexar = $2::jsonb, progreso = 0, paginas = $3, inicio_paginas = $4::int[], tipo = $5, indexando_hasta = NULL WHERE id = $1`,
      [id, JSON.stringify(fragmentos), textos.length, inicioDePaginas(textos), tipo],
    );
    return true;
  });
  if (!sigue && opciones.soloSiPregunta) return { progreso: 0 }; // ya se está leyendo: sus archivos siguen en uso
  await borrarArchivosOcr(lectura.urls);
  return sigue ? { progreso: 0 } : { progreso: null };
}

/** Errores que no son culpa del documento: sin cuota o un problema de la clave. No cuentan como fallos. */
const ERRORES_DE_CLAVE = new Set(['CUOTA_AGOTADA', 'CUOTA_CLAVE_AGOTADA', 'CLAVE_GEMINI_RECHAZADA', 'CLAVE_GEMINI_ILEGIBLE', 'SIN_CLAVE_GEMINI']);

/**
 * Lee un grupo y guarda lo leído; al leer el último, termina. Si falla: el archivo que ya no se puede leer termina con
 * lo leído; otro fallo (no de cuota) se cuenta y, a los OCR_MAX_FALLOS seguidos, también termina. En segundo plano,
 * tras un fallo el documento espera MINUTOS_ESPERA_TRAS_FALLO, así el aviso de cada minuto sigue con los demás.
 */
async function avanzarOcr(
  id: string,
  lectura: LecturaOcr,
  tiempoMaximoMs: number,
  opciones: { enSegundoPlano?: boolean } = {},
): Promise<{ progreso: number | null; ocr?: EstadoOcr; eliminado?: boolean }> {
  let nueva: LecturaOcr;
  try {
    nueva = await leerGrupoOcr(lectura, { tiempoMaximoMs });
  } catch (error) {
    const codigo = error instanceof ErrorDeNegocio ? error.codigo : null;
    if (codigo === 'PDF_INVALIDO') return terminarLectura(id, { ...lectura, porLeer: [] }); // el archivo ya no se puede leer
    const fallos = (lectura.fallos ?? 0) + (codigo && ERRORES_DE_CLAVE.has(codigo) ? 0 : 1);
    if (fallos >= OCR_MAX_FALLOS) return terminarLectura(id, { ...lectura, porLeer: [] });
    const espera = opciones.enSegundoPlano ? `NOW() + make_interval(mins => ${MINUTOS_ESPERA_TRAS_FALLO})` : 'NULL';
    await consultar(`UPDATE documentos SET por_indexar = $2::jsonb, indexando_hasta = ${espera} WHERE id = $1 AND ${ES_LECTURA}`, [
      id,
      JSON.stringify({ ...lectura, fallos }),
    ]).catch(() => {});
    throw error;
  }
  if (nueva.porLeer.length > 0) {
    await consultar(`UPDATE documentos SET por_indexar = $2::jsonb, indexando_hasta = NULL WHERE id = $1 AND ${ES_LECTURA}`, [id, JSON.stringify(nueva)]);
    return { progreso: 0, ocr: estadoDe(nueva) };
  }
  return terminarLectura(id, nueva);
}

/**
 * E20d-3: la respuesta a "¿Leerlas?". "Leerlas" empieza la lectura por grupos (la sigue IndexacionPendiente o el
 * aviso de cada minuto); "Ahora no" indexa solo lo que tenía texto. Una respuesta repetida no cambia nada.
 */
export async function responderOcr(usuarioId: string, id: string, leer: boolean): Promise<{ progreso: number | null; eliminado?: boolean; ocr?: EstadoOcr }> {
  const [fila] = await consultar<{ por_indexar: unknown; progreso: number | null }>('SELECT por_indexar, progreso FROM documentos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  if (!fila) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
  const lectura = fila.por_indexar;
  if (!esLecturaOcr(lectura) || lectura.estado !== 'pregunta') return { progreso: fila.progreso, ...(esLecturaOcr(lectura) ? { ocr: estadoDe(lectura) } : {}) };
  if (leer) {
    await consultar(
      `UPDATE documentos SET por_indexar = jsonb_set(jsonb_set(por_indexar, '{estado}', '"leyendo"'), '{avanzoEn}', to_jsonb($2::text)) WHERE id = $1 AND ${ESPERA_RESPUESTA}`,
      [id, new Date().toISOString()],
    );
    return { progreso: 0, ocr: { ...estadoDe(lectura), estado: 'leyendo' } };
  }
  return terminarLectura(id, { ...lectura, porLeer: [] }, { soloSiPregunta: true });
}

/**
 * E20d-3 (lo llama el aviso de cada minuto): una pregunta sin respuesta en HORAS_PREGUNTA_OCR se toma como "Ahora no",
 * y una lectura que no avanzó en DIAS_LECTURA_SIN_AVANCE (por ejemplo, sin una clave que sirva) termina con lo leído.
 * Así el PDF o las fotos nunca quedan en Blob sin plazo.
 */
export async function vencerPreguntasOcr(): Promise<number> {
  const vencidas = await consultar<{ id: string; por_indexar: LecturaOcr }>(
    `SELECT id, por_indexar FROM documentos
     WHERE (${ESPERA_RESPUESTA} AND (por_indexar->>'venceEn')::timestamptz < NOW())
        OR (${ES_LECTURA} AND por_indexar->>'estado' = 'leyendo' AND (indexando_hasta IS NULL OR indexando_hasta < NOW())
            AND coalesce((por_indexar->>'avanzoEn')::timestamptz, created_at) < NOW() - make_interval(days => $1))
     ORDER BY created_at LIMIT 5`,
    [DIAS_LECTURA_SIN_AVANCE],
  );
  for (const v of vencidas) {
    await terminarLectura(v.id, { ...v.por_indexar, porLeer: [] }, { soloSiPregunta: v.por_indexar.estado === 'pregunta' });
  }
  return vencidas.length;
}

/**
 * RB-38: indexa la parte siguiente de un libro. `ocupado`: otra llamada lo está indexando en este momento.
 * E20d-3: si el documento espera la respuesta del OCR, no hace nada y lo dice; si se está leyendo, lee un grupo.
 */
export async function continuarIndexacion(
  usuarioId: string,
  id: string,
  opciones: { presupuestoMs?: number } = {},
): Promise<{ progreso: number | null; ocupado?: boolean; ocr?: EstadoOcr; eliminado?: boolean }> {
  const [tomado] = await consultar<{ por_indexar: Pendiente[] | LecturaOcr }>(
    `UPDATE documentos SET indexando_hasta = NOW() + make_interval(mins => $3)
     WHERE id = $1 AND usuario_id = $2 AND progreso IS NOT NULL AND (indexando_hasta IS NULL OR indexando_hasta < NOW())
       AND NOT ${ESPERA_RESPUESTA}
     RETURNING por_indexar`,
    [id, usuarioId, LEASE_MINUTOS],
  );
  if (!tomado) {
    const [actual] = await consultar<{ progreso: number | null; por_indexar: unknown }>('SELECT progreso, por_indexar FROM documentos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    if (!actual) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
    if (esLecturaOcr(actual.por_indexar) && actual.por_indexar.estado === 'pregunta') return { progreso: actual.progreso, ocr: estadoDe(actual.por_indexar) };
    return actual.progreso === null ? { progreso: null } : { progreso: actual.progreso, ocupado: true };
  }
  // La ruta tiene 300 s: un grupo de páginas cabe con holgura.
  if (esLecturaOcr(tomado.por_indexar)) return avanzarOcr(id, tomado.por_indexar, 110_000);
  return { progreso: await avanzarIndexacion(id, tomado.por_indexar, opciones.presupuestoMs ?? INDEXACION_PRESUPUESTO_MS) };
}

/**
 * RB-57 (E11c): el aviso de cada minuto avanza una parte del libro a medias más antiguo que nadie esté indexando
 * (respeta indexando_hasta, RB-38). Si Gemini pide esperar por la cuota, no espera: lo intenta en el minuto
 * siguiente. Con la pantalla abierta, el navegador sigue pidiendo partes y no se repiten (el mismo bloqueo).
 * E20c-1 (7.15): cada libro avanza con la clave de su dueño. Solo se toman libros cuyo dueño tiene una clave que
 * sirve (activa o sin cuota por ahora) o, sin clave, puede usar la del proyecto (el dueño de Nova o quien tenga el
 * permiso, E20c-2): con la clave rechazada, ilegible o sin clave, el libro queda en pausa hasta que vincule una que
 * funcione. E20c-2: además, la cuenta debe estar activa y, si no es administradora, por debajo del tope de espacio
 * (RB-85); si no, el libro queda en pausa.
 */
const ERRORES_DE_IA = new Set(['ERROR_LLM', 'CUOTA_AGOTADA', 'CUOTA_CLAVE_AGOTADA', 'CLAVE_GEMINI_RECHAZADA', 'CLAVE_GEMINI_ILEGIBLE', 'SIN_CLAVE_GEMINI']);

export async function avanzarLibroEnSegundoPlano(): Promise<
  { documentoId: string; progreso: number | null; esperaCuota?: boolean } | null
> {
  const [tomado] = await consultar<{ id: string; usuario_id: string; por_indexar: Pendiente[] | LecturaOcr; progreso: number }>(
    `UPDATE documentos SET indexando_hasta = NOW() + make_interval(mins => $1)
     WHERE id = (
       SELECT d.id FROM documentos d
       WHERE d.progreso IS NOT NULL AND (d.indexando_hasta IS NULL OR d.indexando_hasta < NOW())
         AND NOT (jsonb_typeof(d.por_indexar) = 'object' AND d.por_indexar->>'estado' = 'pregunta')
         AND EXISTS (
           SELECT 1 FROM cuentas c
           WHERE c.usuario_id = d.usuario_id AND c.estado = 'activa'
             AND (c.nivel IN ('dueno', 'admin')
                  OR coalesce((SELECT e.bytes FROM nova_espacio(d.usuario_id) e), 0)
                     < (SELECT a.tope_espacio_mb FROM administracion a WHERE a.id = 1)::bigint * 1048576)
             AND (
               EXISTS (SELECT 1 FROM claves_gemini k WHERE k.usuario_id = d.usuario_id AND k.estado IN ('activa', 'sin_cuota'))
               OR (NOT EXISTS (SELECT 1 FROM claves_gemini k WHERE k.usuario_id = d.usuario_id)
                   AND (c.nivel = 'dueno' OR c.usa_clave_proyecto))
             )
         )
       ORDER BY d.created_at LIMIT 1 FOR UPDATE OF d SKIP LOCKED
     ) AND progreso IS NOT NULL AND (indexando_hasta IS NULL OR indexando_hasta < NOW())
     RETURNING id, usuario_id, por_indexar, progreso`,
    [LEASE_MINUTOS],
  );
  if (!tomado) return null;
  try {
    // E20d-3: un documento que se lee con OCR avanza un grupo; el aviso tiene 60 s.
    const por = tomado.por_indexar;
    const progreso = await conIaDe(tomado.usuario_id, async () =>
      esLecturaOcr(por) ? (await avanzarOcr(tomado.id, por, 45_000, { enSegundoPlano: true })).progreso : avanzarIndexacion(tomado.id, por, 0, { sinEsperarCuota: true }),
    );
    return { documentoId: tomado.id, progreso };
  } catch (error) {
    // Sin cuota o con un problema de la clave: se intenta en el minuto siguiente (la consulta de arriba ya deja
    // fuera a quien tenga la clave rechazada o ilegible).
    if (error instanceof ErrorDeNegocio && ERRORES_DE_IA.has(error.codigo)) return { documentoId: tomado.id, progreso: tomado.progreso, esperaCuota: true };
    throw error;
  }
}

/** RB-37: los capítulos de un documento del usuario, en orden. */
export async function capitulosDeDocumento(usuarioId: string, id: string): Promise<CapitulosDocumento> {
  const [documento] = await consultar<CapitulosDocumento['documento']>(
    'SELECT id, nombre_archivo AS "nombreArchivo", paginas, categoria, tipo, unidad FROM documentos WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId],
  );
  if (!documento) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
  const capitulos = await consultar<Capitulo>(
    `SELECT orden, nivel, titulo, pagina_inicio AS "paginaInicio", pagina_fin AS "paginaFin", etiqueta_paginas AS "etiquetaPaginas",
            tarea_id IS NOT NULL AS "enTareas", tipo
     FROM capitulos WHERE documento_id = $1 AND usuario_id = $2 ORDER BY orden`,
    [id, usuarioId],
  );
  return { documento, capitulos };
}

/** Las fotos de un documento tienen como máximo 30 páginas (OCR_MAX_FOTOS); el tope protege la pantalla. */
const MAX_PAGINAS_TEXTO = 30;

/**
 * Ajuste de E20d-4 (pedido del usuario): "Ver contenido" de las fotos muestra lo que Nova leyó en cada una. Arma el
 * texto de cada página con los fragmentos guardados, sin repetir el solapamiento (RB-39). Sin `inicio_paginas`
 * (documentos viejos) no se puede separar por página y devuelve una lista vacía.
 */
export async function textoDePaginas(usuarioId: string, documentoId: string): Promise<Array<{ pagina: number; texto: string }>> {
  const [documento] = await consultar<{ paginas: number | null; inicioPaginas: number[] | null; progreso: number | null }>(
    'SELECT paginas, inicio_paginas AS "inicioPaginas", progreso FROM documentos WHERE id = $1 AND usuario_id = $2',
    [documentoId, usuarioId],
  );
  if (!documento) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
  // Mientras se indexa, los fragmentos llegan por partes: no se muestra un texto a medias.
  if (!documento.paginas || !documento.inicioPaginas || documento.progreso !== null) return [];
  const fragmentos = await consultar<{ numero: number; contenido: string }>(
    // El documento ya se comprobó como del usuario (RB-01); los fragmentos se buscan por él.
    'SELECT numero, contenido FROM fragmentos_pdf WHERE documento_id = $1 ORDER BY numero',
    [documentoId],
  );
  const total = Math.min(documento.paginas, MAX_PAGINAS_TEXTO);
  return Array.from({ length: total }, (_, i) => ({
    pagina: i + 1,
    texto: soloTextoDePagina(fragmentos, i + 1, documento.inicioPaginas as number[]).map((f) => f.contenido).join(' '),
  }));
}

/**
 * CU-02: la ruta recibe la URL del Blob, nunca el archivo (sección 2.2).
 * El store es público, así que el PDF se borra al terminar, tanto si se indexó como si se rechazó:
 * lo que se consulta después son los fragmentos guardados en la base.
 */
export async function indexarDocumento(usuarioId: string, d: {
  urlBlob: string;
  masUrls?: string[] | undefined;
  nombreArchivo: string;
  categoria?: string | undefined;
  materiaId?: string | undefined;
}, opciones: { alEtapa?: ((etapa: EtapaServidor) => void) | undefined } = {}): Promise<ResultadoIndexacion> {
  const urls = [d.urlBlob, ...(d.masUrls ?? [])];
  // E20d-4: las fotos no se descargan aquí: se leen con OCR después de "Leerlas".
  if (urls.some((u) => tipoDeArchivo(new URL(u).pathname) === 'imagen')) {
    try {
      return await iniciarFotos(usuarioId, { ...d, urls });
    } catch (error) {
      await borrarArchivosOcr(urls);
      throw error;
    }
  }
  if (urls.length > 1) {
    await borrarArchivosOcr(urls);
    throw new ErrorDeNegocio('TIPO_NO_ADMITIDO', 'Solo las fotos se pueden subir varias juntas.');
  }
  let conservar = false;
  try {
    opciones.alEtapa?.('leer'); // E20b: etapas visibles (descargar y extraer el texto)
    const contenido = await descargarArchivo(d.urlBlob);
    const resultado = await indexarContenido(usuarioId, contenido, d, { alEtapa: opciones.alEtapa });
    // E20d-3: con páginas escaneadas, el PDF se queda en Blob hasta leerlas (o hasta "Ahora no").
    conservar = Boolean(resultado.ocr);
    return resultado;
  } finally {
    // Un fallo al borrar no invalida la indexación; queda en el registro para limpiarlo a mano.
    if (!conservar) await del(d.urlBlob).catch((error: unknown) => {
      console.error('No se pudo borrar el PDF de Vercel Blob:', error);
    });
  }
}

export async function listarDocumentos(usuarioId: string): Promise<Documento[]> {
  return consultar<Documento>(
    `SELECT id,
       nombre_archivo AS "nombreArchivo",
       categoria,
       num_fragmentos AS "numFragmentos",
       fecha_guardado AS "fechaGuardado",
       paginas,
       progreso,
       tipo,
       unidad,
       CASE WHEN jsonb_typeof(por_indexar) = 'object' THEN jsonb_build_object(
         'estado', por_indexar->>'estado', 'fuente', por_indexar->>'fuente',
         'total', (por_indexar->>'total')::int, 'leidas', jsonb_array_length(por_indexar->'leidas')
       ) END AS ocr,
       (SELECT count(*)::int FROM capitulos c WHERE c.documento_id = documentos.id) AS "numCapitulos",
       (SELECT m.nombre FROM materias m WHERE m.id = documentos.materia_id AND m.usuario_id = documentos.usuario_id) AS materia
     FROM documentos
     WHERE usuario_id = $2
     ORDER BY created_at DESC
     LIMIT $1`,
    [LIMITE_LISTADO, usuarioId],
  );
}

/**
 * RN-22: el borrado es definitivo; sus fragmentos caen por ON DELETE CASCADE y el PDF ya no está en Blob
 * (se borra al indexar). La interfaz pide confirmación antes de llamarlo.
 */
export async function eliminarDocumento(usuarioId: string, id: string): Promise<void> {
  const borrados = await consultar<{ id: string; por_indexar: unknown }>(
    'DELETE FROM documentos WHERE id = $1 AND usuario_id = $2 RETURNING id, por_indexar',
    [id, usuarioId],
  );
  if (borrados.length === 0) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
  // E20d-3: si esperaba el OCR, su PDF o sus fotos siguen en Blob.
  const lectura = borrados[0]?.por_indexar;
  if (esLecturaOcr(lectura)) await borrarArchivosOcr(lectura.urls);
}

/** RN-15 por usuario: A-13 ("una cuenta sin PDF") ya se cumple por cuenta, no por base. */
export async function existenDocumentos(usuarioId: string): Promise<boolean> {
  const [fila] = await consultar<{ existe: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM documentos WHERE usuario_id = $1 AND num_fragmentos > 0) AS existe',
    [usuarioId],
  );
  return fila?.existe ?? false;
}
