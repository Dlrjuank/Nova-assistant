import { del } from '@vercel/blob';
import { Type, type Schema } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import { llm } from '@/lib/llm/gemini';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { OCR_MAX_BYTES_POR_LLAMADA, OCR_PAGINAS_POR_LLAMADA, pedidoOcr, siguienteGrupo, SISTEMA_OCR, textosDeRespuesta, type LecturaOcr } from '@/lib/reglas/ocr';
import { mimeDeArchivo } from '@/lib/reglas/tiposDocumento';
import { descargarArchivo } from './descargas';

/**
 * E20d-3 y E20d-4: leer con Gemini un grupo de páginas de un PDF escaneado (separadas con `pdf-lib`) o de fotos.
 * Cada llamada lee un solo grupo, así cabe en una parte de la indexación (RB-38) o en el aviso de cada minuto.
 */

const ESQUEMA_OCR: Schema = {
  type: Type.OBJECT,
  properties: {
    paginas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { pagina: { type: Type.INTEGER }, texto: { type: Type.STRING } },
        required: ['pagina', 'texto'],
      },
    },
  },
  required: ['paginas'],
};

/** Solo las páginas pedidas (desde 1), en un PDF nuevo. */
export async function separarPaginas(pdf: Uint8Array, paginas: readonly number[]): Promise<Uint8Array> {
  let origen: PDFDocument;
  try {
    origen = await PDFDocument.load(pdf, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new ErrorDeNegocio('PDF_INVALIDO');
  }
  const nuevo = await PDFDocument.create();
  const copiadas = await nuevo.copyPages(origen, paginas.map((p) => p - 1));
  for (const pagina of copiadas) nuevo.addPage(pagina);
  return nuevo.save();
}

/**
 * Las fotos del grupo, descargadas de a una hasta OCR_PAGINAS_POR_LLAMADA o el tope de bytes. Una foto que sola
 * pasa del tope no cabe en una llamada: va en `saltadas` (queda sin texto) en vez de fallar siempre.
 */
async function fotosDelGrupo(lectura: LecturaOcr): Promise<{ grupo: number[]; saltadas: number[]; archivos: Array<{ mimeType: string; datos: Uint8Array }> }> {
  const grupo: number[] = [];
  const saltadas: number[] = [];
  const archivos: Array<{ mimeType: string; datos: Uint8Array }> = [];
  let bytes = 0;
  for (const pagina of lectura.porLeer) {
    if (grupo.length >= OCR_PAGINAS_POR_LLAMADA) break;
    const datos = await descargarArchivo(lectura.urls[pagina - 1] as string);
    if (datos.length > OCR_MAX_BYTES_POR_LLAMADA) {
      saltadas.push(pagina);
      continue;
    }
    if (grupo.length > 0 && bytes + datos.length > OCR_MAX_BYTES_POR_LLAMADA) break; // va en el grupo siguiente
    grupo.push(pagina);
    archivos.push({ mimeType: mimeDeArchivo(lectura.urls[pagina - 1] as string) ?? 'image/jpeg', datos });
    bytes += datos.length;
  }
  return { grupo, saltadas, archivos };
}

/** Las páginas del grupo de un PDF en un PDF nuevo; si pasa del tope de bytes, el grupo se parte a la mitad. */
async function paginasDelPdf(pdf: Uint8Array, porLeer: readonly number[]): Promise<{ grupo: number[]; datos: Uint8Array }> {
  let grupo = siguienteGrupo(porLeer);
  for (;;) {
    const datos = await separarPaginas(pdf, grupo);
    if (datos.length <= OCR_MAX_BYTES_POR_LLAMADA || grupo.length === 1) return { grupo, datos };
    grupo = grupo.slice(0, Math.ceil(grupo.length / 2));
  }
}

/**
 * Lee el grupo siguiente y devuelve la lectura con esos textos. Una página que el modelo no devolvió queda vacía y
 * cuenta como leída, para no gastar consultas en repetirla.
 */
export async function leerGrupoOcr(lectura: LecturaOcr, opciones: { tiempoMaximoMs?: number } = {}): Promise<LecturaOcr> {
  if (lectura.porLeer.length === 0) return lectura;
  let grupo: number[];
  let saltadas: number[] = [];
  let archivos: Array<{ mimeType: string; datos: Uint8Array }>;
  if (lectura.fuente === 'pdf') {
    // El PDF se descarga en cada grupo: no se guarda en memoria entre llamadas.
    const parte = await paginasDelPdf(await descargarArchivo(lectura.urls[0] as string), lectura.porLeer);
    grupo = parte.grupo;
    archivos = [{ mimeType: 'application/pdf', datos: parte.datos }];
  } else {
    ({ grupo, saltadas, archivos } = await fotosDelGrupo(lectura));
  }
  const avanzoEn = new Date().toISOString();
  if (grupo.length === 0) {
    // Solo había fotos que no caben: quedan sin texto y la lectura sigue.
    const fuera = new Set(saltadas);
    return { ...lectura, porLeer: lectura.porLeer.filter((p) => !fuera.has(p)), avanzoEn, fallos: 0 };
  }
  const respuesta = await llm.leerArchivos({
    sistema: SISTEMA_OCR,
    pedido: pedidoOcr(grupo.length, lectura.fuente),
    archivos,
    esquema: ESQUEMA_OCR,
    tiempoMaximoMs: opciones.tiempoMaximoMs,
  });
  const textos = textosDeRespuesta(respuesta, grupo.length);
  const nuevos = [...lectura.textos];
  grupo.forEach((p, i) => {
    nuevos[p - 1] = textos[i] as string;
  });
  const hechas = new Set([...grupo, ...saltadas]);
  return { ...lectura, textos: nuevos, porLeer: lectura.porLeer.filter((p) => !hechas.has(p)), leidas: [...lectura.leidas, ...grupo], avanzoEn, fallos: 0 };
}

/** Borra de Blob el PDF o las fotos; un fallo queda en el registro (el almacén es público: es un riesgo corto). */
export async function borrarArchivosOcr(urls: readonly string[]): Promise<void> {
  await Promise.all(
    urls.map((u) =>
      del(u).catch((error: unknown) => {
        console.error('No se pudo borrar un archivo del OCR en Vercel Blob:', error);
      }),
    ),
  );
}
