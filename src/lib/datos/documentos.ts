import { del } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { CATEGORIA_POR_DEFECTO, INDEXACION_LOTE, INDEXACION_PRESUPUESTO_MS, LIMITE_LISTADO, PDF_MAX_BYTES } from '@/lib/config/nova';
import { aLiteralVector, conTransaccion, consultar } from '@/lib/db/conexion';
import { llm } from '@/lib/llm/gemini';
import { extraerPdf } from '@/lib/pdf/extraer';
import { seccionesMarkdown, partesDeTexto, decodificarTexto } from '@/lib/lectores/texto';
import { leerDocx, leerPptx } from '@/lib/lectores/office';
import { EXTENSIONES_ADMITIDAS, extensionDe, tipoDeArchivo, TIPOS_MIME_ADMITIDOS, type EstructuraDocumento, type TipoDocumento } from '@/lib/reglas/tiposDocumento';
import { validarTamanoPdf, validarTextoExtraido } from '@/lib/reglas/documento';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import type { EtapaServidor } from '@/lib/reglas/etapasIndexacion';
import { hoyBogota } from '@/lib/reglas/fechas';
import { detectarCapitulos, fragmentarPaginas, inicioDePaginas, validarPaginas, type FragmentoLibro } from '@/lib/reglas/libros';
import type { Capitulo, CapitulosDocumento, Documento, ResultadoIndexacion } from './tipos';
import { conIaDe } from '@/lib/llm/contextoIa';

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

/** Descarga el Blob cortando en cuanto supera el límite, para no cargar en memoria un archivo enorme (RN-01). */
async function descargarArchivo(urlBlob: string): Promise<Uint8Array> {
  const respuesta = await fetch(urlBlob, { redirect: 'error' });
  if (!respuesta.ok || !respuesta.body) throw new ErrorDeNegocio('PDF_INVALIDO');

  const partes: Uint8Array[] = [];
  let total = 0;
  const lector = respuesta.body.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.length;
    try {
      validarTamanoPdf(total);
    } catch (error) {
      await lector.cancel();
      throw error;
    }
    partes.push(value);
  }

  const bytes = new Uint8Array(total);
  let posicion = 0;
  for (const parte of partes) {
    bytes.set(parte, posicion);
    posicion += parte.length;
  }
  return bytes;
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
          `INSERT INTO fragmentos_pdf (documento_id, numero, contenido, vector, pagina_inicio, pagina_fin, etiqueta_paginas)
           SELECT $1, t.numero, t.contenido, t.vector::vector, t.inicio, t.fin, t.etiqueta
           FROM unnest($2::int[], $3::text[], $4::text[], $5::smallint[], $6::smallint[], $7::text[])
             AS t(numero, contenido, vector, inicio, fin, etiqueta)
           ON CONFLICT (documento_id, numero) DO NOTHING`,
          [
            documentoId,
            lote.map((f) => f.numero),
            lote.map((f) => f.contenido),
            vectores.map(aLiteralVector),
            lote.map((f) => f.paginaInicio),
            lote.map((f) => f.paginaFin),
            lote.map((f) => f.etiquetaPaginas),
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
  // Postgres no admite el carácter NUL en columnas de texto y algunos PDF lo incluyen.
  const paginas = extraido.paginas.map((p) => p.replaceAll('\u0000', ' '));
  validarPaginas(paginas.length); // RB-38
  validarTextoExtraido(paginas.join(' '));
  const capitulos = detectarCapitulos(paginas, extraido.indice, extraido.etiquetas); // RB-37
  return { unidad: 'pagina', unidades: paginas, etiquetas: extraido.etiquetas, grupos: capitulos.map((c) => ({ ...c, tipo: 'capitulo' as const })) };
}

/**
 * Valida, fragmenta por páginas y empieza a indexar un PDF ya descargado. Los libros largos siguen por partes
 * con continuarIndexacion (RB-38). Se exporta para los scripts, que indexan sin pasar por Blob; dataService no lo expone.
 */
export async function indexarContenido(
  usuarioId: string,
  contenido: Uint8Array,
  d: { nombreArchivo: string; categoria?: string | undefined; materiaId?: string | undefined },
  opciones: { presupuestoMs?: number; alEtapa?: ((etapa: EtapaServidor) => void) | undefined } = {},
): Promise<ResultadoIndexacion> {
  const alEtapa = opciones.alEtapa ?? (() => {});
  // E13 (B-21): con una materia del usuario, su nombre es la categoría; una ajena responde como inexistente.
  let categoria = d.categoria?.trim() || CATEGORIA_POR_DEFECTO;
  if (d.materiaId) {
    const [materia] = await consultar<{ nombre: string }>('SELECT nombre FROM materias WHERE id = $1 AND usuario_id = $2', [d.materiaId, usuarioId]);
    if (!materia) throw new ErrorDeNegocio('MATERIA_NO_ENCONTRADA');
    categoria = materia.nombre;
  }
  validarTamanoPdf(contenido.length);
  // E20d: el tipo sale de la extensión del nombre (la subida ya solo admite esas).
  const tipo = tipoDeArchivo(d.nombreArchivo);
  if (!tipo) throw new ErrorDeNegocio('TIPO_NO_ADMITIDO');
  const { unidad, unidades: paginas, etiquetas, grupos: capitulos } = await leerEstructura(tipo, contenido);

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
    if (capitulos.length > 0) {
      await tx.query(
        `INSERT INTO capitulos (documento_id, usuario_id, orden, nivel, titulo, pagina_inicio, pagina_fin, etiqueta_paginas, tipo)
         SELECT $1, $2, t.orden, t.nivel, t.titulo, t.inicio, t.fin, t.etiqueta, t.tipo
         FROM unnest($3::smallint[], $4::smallint[], $5::text[], $6::smallint[], $7::smallint[], $8::text[], $9::text[])
           AS t(orden, nivel, titulo, inicio, fin, etiqueta, tipo)`,
        [
          id,
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

/** RB-38: indexa la parte siguiente de un libro. `ocupado`: otra llamada lo está indexando en este momento. */
export async function continuarIndexacion(
  usuarioId: string,
  id: string,
  opciones: { presupuestoMs?: number } = {},
): Promise<{ progreso: number | null; ocupado?: boolean }> {
  const [tomado] = await consultar<{ por_indexar: Pendiente[] }>(
    `UPDATE documentos SET indexando_hasta = NOW() + make_interval(mins => $3)
     WHERE id = $1 AND usuario_id = $2 AND progreso IS NOT NULL AND (indexando_hasta IS NULL OR indexando_hasta < NOW())
     RETURNING por_indexar`,
    [id, usuarioId, LEASE_MINUTOS],
  );
  if (!tomado) {
    const [actual] = await consultar<{ progreso: number | null }>('SELECT progreso FROM documentos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    if (!actual) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
    return actual.progreso === null ? { progreso: null } : { progreso: actual.progreso, ocupado: true };
  }
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
const ERRORES_DE_IA = new Set(['ERROR_LLM', 'CUOTA_CLAVE_AGOTADA', 'CLAVE_GEMINI_RECHAZADA', 'CLAVE_GEMINI_ILEGIBLE', 'SIN_CLAVE_GEMINI']);

export async function avanzarLibroEnSegundoPlano(): Promise<
  { documentoId: string; progreso: number | null; esperaCuota?: boolean } | null
> {
  const [tomado] = await consultar<{ id: string; usuario_id: string; por_indexar: Pendiente[]; progreso: number }>(
    `UPDATE documentos SET indexando_hasta = NOW() + make_interval(mins => $1)
     WHERE id = (
       SELECT d.id FROM documentos d
       WHERE d.progreso IS NOT NULL AND (d.indexando_hasta IS NULL OR d.indexando_hasta < NOW())
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
    const progreso = await conIaDe(tomado.usuario_id, () => avanzarIndexacion(tomado.id, tomado.por_indexar, 0, { sinEsperarCuota: true }));
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

/**
 * CU-02: la ruta recibe la URL del Blob, nunca el archivo (sección 2.2).
 * El store es público, así que el PDF se borra al terminar, tanto si se indexó como si se rechazó:
 * lo que se consulta después son los fragmentos guardados en la base.
 */
export async function indexarDocumento(usuarioId: string, d: {
  urlBlob: string;
  nombreArchivo: string;
  categoria?: string | undefined;
  materiaId?: string | undefined;
}, opciones: { alEtapa?: ((etapa: EtapaServidor) => void) | undefined } = {}): Promise<ResultadoIndexacion> {
  try {
    opciones.alEtapa?.('leer'); // E20b: etapas visibles (descargar y extraer el texto)
    const contenido = await descargarArchivo(d.urlBlob);
    return await indexarContenido(usuarioId, contenido, d, { alEtapa: opciones.alEtapa });
  } finally {
    // Un fallo al borrar no invalida la indexación; queda en el registro para limpiarlo a mano.
    await del(d.urlBlob).catch((error: unknown) => {
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
  const borrados = await consultar<{ id: string }>(
    'DELETE FROM documentos WHERE id = $1 AND usuario_id = $2 RETURNING id',
    [id, usuarioId],
  );
  if (borrados.length === 0) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
}

/** RN-15 por usuario: A-13 ("una cuenta sin PDF") ya se cumple por cuenta, no por base. */
export async function existenDocumentos(usuarioId: string): Promise<boolean> {
  const [fila] = await consultar<{ existe: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM documentos WHERE usuario_id = $1 AND num_fragmentos > 0) AS existe',
    [usuarioId],
  );
  return fila?.existe ?? false;
}
