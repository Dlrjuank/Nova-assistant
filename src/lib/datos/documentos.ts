import { del } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { CATEGORIA_POR_DEFECTO, LIMITE_LISTADO, PDF_MAX_BYTES } from '@/lib/config/nova';
import { aLiteralVector, conTransaccion, consultar } from '@/lib/db/conexion';
import { llm } from '@/lib/llm/gemini';
import { extraerTexto } from '@/lib/pdf/extraer';
import { validarTamanoPdf, validarTextoExtraido } from '@/lib/reglas/documento';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { hoyBogota } from '@/lib/reglas/fechas';
import { fragmentar } from '@/lib/reglas/fragmentacion';
import type { Documento } from './tipos';

/**
 * Protocolo de subida client-side de Vercel Blob; devuelve lo que espera upload() en el navegador.
 * Sin onUploadCompleted no se registra webhook, así que la ruta puede exigir sesión en todas sus llamadas.
 */
export async function emitirTokenSubida(cuerpo: HandleUploadBody, peticion: Request) {
  return handleUpload({
    body: cuerpo,
    request: peticion,
    onBeforeGenerateToken: async (ruta) => {
      if (!ruta.toLowerCase().endsWith('.pdf')) throw new ErrorDeNegocio('PDF_INVALIDO');
      return {
        allowedContentTypes: ['application/pdf'],
        maximumSizeInBytes: PDF_MAX_BYTES,
        addRandomSuffix: true,
      };
    },
  });
}

/** Descarga el Blob cortando en cuanto supera el límite, para no cargar en memoria un archivo enorme (RN-01). */
async function descargarPdf(urlBlob: string): Promise<Uint8Array> {
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

/**
 * Valida, fragmenta, vectoriza y guarda un PDF ya descargado.
 * Se exporta para scripts/probar-rag.ts, que indexa sin pasar por Blob; dataService no lo expone.
 */
export async function indexarContenido(
  contenido: Uint8Array,
  d: { nombreArchivo: string; categoria?: string | undefined },
): Promise<{ documentoId: string; numFragmentos: number }> {
  validarTamanoPdf(contenido.length);
  // Postgres no admite el carácter NUL en columnas de texto y algunos PDF lo incluyen.
  const texto = (await extraerTexto(contenido)).replaceAll('\u0000', ' ');
  validarTextoExtraido(texto);

  const fragmentos = fragmentar(texto);
  // Los embeddings se generan antes de la transacción para no retener una conexión durante las llamadas a Gemini.
  const vectores = await llm.generarEmbeddings(fragmentos.map((f) => f.contenido));

  const documentoId = await conTransaccion(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO documentos (nombre_archivo, categoria, num_fragmentos, fecha_guardado)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [d.nombreArchivo, d.categoria?.trim() || CATEGORIA_POR_DEFECTO, fragmentos.length, hoyBogota()],
    );
    const id = (rows[0] as { id: string }).id;
    await tx.query(
      `INSERT INTO fragmentos_pdf (documento_id, numero, contenido, vector)
       SELECT $1, t.numero, t.contenido, t.vector::vector
       FROM unnest($2::int[], $3::text[], $4::text[]) AS t(numero, contenido, vector)`,
      [
        id,
        fragmentos.map((f) => f.numero),
        fragmentos.map((f) => f.contenido),
        vectores.map(aLiteralVector),
      ],
    );
    return id;
  });

  return { documentoId, numFragmentos: fragmentos.length };
}

/**
 * CU-02: la ruta recibe la URL del Blob, nunca el archivo (sección 2.2).
 * El store es público, así que el PDF se borra al terminar, tanto si se indexó como si se rechazó:
 * lo que se consulta después son los fragmentos guardados en la base.
 */
export async function indexarDocumento(d: {
  urlBlob: string;
  nombreArchivo: string;
  categoria?: string | undefined;
}): Promise<{ documentoId: string; numFragmentos: number }> {
  try {
    const contenido = await descargarPdf(d.urlBlob);
    return await indexarContenido(contenido, d);
  } finally {
    // Un fallo al borrar no invalida la indexación; queda en el registro para limpiarlo a mano.
    await del(d.urlBlob).catch((error: unknown) => {
      console.error('No se pudo borrar el PDF de Vercel Blob:', error);
    });
  }
}

export async function listarDocumentos(): Promise<Documento[]> {
  return consultar<Documento>(
    `SELECT id,
       nombre_archivo AS "nombreArchivo",
       categoria,
       num_fragmentos AS "numFragmentos",
       fecha_guardado AS "fechaGuardado"
     FROM documentos
     ORDER BY created_at DESC
     LIMIT $1`,
    [LIMITE_LISTADO],
  );
}

/**
 * RN-22: el borrado es definitivo; sus fragmentos caen por ON DELETE CASCADE y el PDF ya no está en Blob
 * (se borra al indexar). La interfaz pide confirmación antes de llamarlo.
 */
export async function eliminarDocumento(id: string): Promise<void> {
  const borrados = await consultar<{ id: string }>('DELETE FROM documentos WHERE id = $1 RETURNING id', [id]);
  if (borrados.length === 0) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO');
}

export async function existenDocumentos(): Promise<boolean> {
  const [fila] = await consultar<{ existe: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM documentos WHERE num_fragmentos > 0) AS existe',
  );
  return fila?.existe ?? false;
}
