// @vitest-environment node
// E20d-3: reglas del OCR, detección de páginas escaneadas con un PDF real y separación de páginas con pdf-lib.
import { deflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { separarPaginas } from '@/lib/datos/ocr';
import { etiquetaFragmento } from '@/lib/llm/prompts';
import { extraerPdf } from '@/lib/pdf/extraer';
import { fragmentarPaginas } from '@/lib/reglas/libros';
import { estimarOcr, OCR_MAX_BYTES_POR_LLAMADA, paginasSinTexto, siguienteGrupo, textoPreguntaOcr, textosDeRespuesta } from '@/lib/reglas/ocr';

/** Un PNG gris de 1×1, armado a mano (firma, IHDR, IDAT y IEND con su CRC). */
function pngGris(): Uint8Array {
  const tabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = (tabla[(c ^ x) & 0xff] as number) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const trozo = (tipo: string, datos: Buffer) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0]); // 1×1, 8 bits, escala de grises
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(Buffer.from([0, 128]))),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

/** Página 1 con texto, página 2 escaneada (una imagen que la cubre), página 3 en blanco. */
async function pdfMixto(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([400, 600]).drawText('Capitulo uno. La fotosintesis convierte la luz en energia.', { x: 20, y: 500, size: 10, font: fuente });
  const imagen = await pdf.embedPng(pngGris());
  pdf.addPage([400, 600]).drawImage(imagen, { x: 0, y: 0, width: 400, height: 600 });
  pdf.addPage([400, 600]);
  return pdf.save();
}

describe('reglas del OCR', () => {
  it('páginas sin texto, estimación y pregunta', () => {
    expect(paginasSinTexto(['Un texto largo de verdad con palabras', '  12  ', ''])).toEqual([2, 3]);
    expect(estimarOcr(180)).toEqual({ consultas: 18, minutos: 6 });
    expect(estimarOcr(3)).toEqual({ consultas: 1, minutos: 1 });
    expect(textoPreguntaOcr(180, 'pdf')).toBe('Este PDF tiene 180 páginas escaneadas. Leerlas usa unas 18 consultas de tu clave de Gemini (unos 6 minutos). ¿Leerlas?');
    expect(textoPreguntaOcr(1, 'fotos')).toBe('Esta foto se lee con OCR. Leerla usa una consulta de tu clave de Gemini (cerca de un minuto). ¿Leerla?');
    expect(textoPreguntaOcr(5, 'fotos')).toBe('Estas 5 fotos se leen con OCR. Leerlas usa una consulta de tu clave de Gemini (cerca de un minuto). ¿Leerlas?');
  });

  it('grupos de hasta 10 páginas y sin pasar del tope de bytes (siempre al menos una)', () => {
    const muchas = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(siguienteGrupo(muchas)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const grande = OCR_MAX_BYTES_POR_LLAMADA / 2 + 1;
    expect(siguienteGrupo([4, 5, 6], () => grande)).toEqual([4]);
    expect(siguienteGrupo([7], () => OCR_MAX_BYTES_POR_LLAMADA * 2)).toEqual([7]);
  });

  it('la respuesta del modelo: en orden, sin NUL, y la que falte queda vacía', () => {
    expect(textosDeRespuesta({ paginas: [{ pagina: 2, texto: ' dos ' }, { pagina: 1, texto: 'uno\u0000x' }] }, 3)).toEqual(['uno x', 'dos', '']);
    expect(textosDeRespuesta({ nada: true }, 2)).toEqual(['', '']);
  });

  it('el fragmento que toca una página leída con OCR se marca y se cita "(escaneada)"', () => {
    const [f] = fragmentarPaginas(['uno dos', 'tres cuatro'], null, new Set([2]));
    expect(f?.ocr).toBe(true);
    expect(fragmentarPaginas(['uno dos'], null, new Set([5]))[0]?.ocr).toBeUndefined();
    expect(etiquetaFragmento({ nombre_archivo: 'Libro.pdf', numero: 1, etiqueta_paginas: '45', ocr: true })).toBe('Libro.pdf · p. 45 (escaneada)');
  });
});

describe('PDF real', () => {
  it('detecta solo la página escaneada: la de texto y la en blanco no cuentan', async () => {
    const extraido = await extraerPdf(await pdfMixto());
    expect(extraido.paginas).toHaveLength(3);
    expect(extraido.escaneadas).toEqual([2]);
  });

  it('separa las páginas pedidas en un PDF nuevo', async () => {
    const parte = await separarPaginas(await pdfMixto(), [1, 3]);
    expect((await PDFDocument.load(parte)).getPageCount()).toBe(2);
    await expect(separarPaginas(new Uint8Array([1, 2, 3]), [1])).rejects.toMatchObject({ codigo: 'PDF_INVALIDO' });
  });
});

describe('tope de bytes en las llamadas', () => {
  it('un grupo de un PDF que pasa de 12 MB se parte a la mitad', async () => {
    const { leerGrupoOcr } = await import('@/lib/datos/ocr');
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 4; i++) pdf.addPage([100, 100]);
    const bytes = await pdf.save();
    const original = PDFDocument.prototype.save;
    // El primer intento (4 páginas) "pesa" de más; el segundo (2 páginas), no.
    let llamadas = 0;
    PDFDocument.prototype.save = async function (this: PDFDocument) {
      llamadas++;
      return llamadas === 1 ? new Uint8Array(OCR_MAX_BYTES_POR_LLAMADA + 1) : original.call(this);
    };
    const gemini = await import('@/lib/llm/gemini');
    const espia = vi.spyOn(gemini.llm, 'leerArchivos').mockResolvedValue({ paginas: [] });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob([bytes as BlobPart]))));
    try {
      const nueva = await leerGrupoOcr({ ocr: true, estado: 'leyendo', fuente: 'pdf', urls: ['https://x.public.blob.vercel-storage.com/a.pdf'], textos: ['', '', '', ''], porLeer: [1, 2, 3, 4], leidas: [], total: 4, etiquetas: null, indice: [], venceEn: '' });
      expect(nueva.leidas).toEqual([1, 2]);
      expect(nueva.porLeer).toEqual([3, 4]);
    } finally {
      PDFDocument.prototype.save = original;
      espia.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
