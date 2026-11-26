// E20d-3 y E20d-4 (PROMPTS_AMPLIACION, E20d): el OCR con Gemini real, una sola vez y con pocas páginas.
// Arma un PDF de 3 páginas (texto, escaneada y en blanco) y una foto PNG, con un texto dibujado con una fuente de
// píxeles propia (sin librerías de imágenes). Comprueba que solo la escaneada se detecta, que Gemini la lee y que
// lee la foto: dos llamadas en total, con la clave del proyecto. No toca la base ni Blob (las descargas se sirven
// desde la memoria). Uso: npm run probar:ocr
import { deflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { leerGrupoOcr } from '@/lib/datos/ocr';
import { conClaveDelProyecto } from '@/lib/llm/contextoIa';
import { extraerPdf } from '@/lib/pdf/extraer';
import type { LecturaOcr } from '@/lib/reglas/ocr';
import { cargarEnv } from './cargar-env.mjs';

cargarEnv();

/** Fuente de 5×7 píxeles: solo las letras que se usan. */
const FUENTE: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function crc32(datos: Buffer): number {
  let c = 0xffffffff;
  for (const x of datos) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Un PNG en escala de grises con las líneas de texto, letras negras sobre blanco. */
function pngConTexto(lineas: string[], escala = 6): Uint8Array {
  const ancho = Math.max(...lineas.map((l) => l.length)) * 6 * escala + 4 * escala;
  const alto = lineas.length * 9 * escala + 4 * escala;
  const pixeles = Buffer.alloc((ancho + 1) * alto, 255);
  for (let y = 0; y < alto; y++) pixeles[y * (ancho + 1)] = 0; // filtro 0 en cada fila
  lineas.forEach((linea, l) => {
    [...linea].forEach((letra, i) => {
      const glifo = FUENTE[letra] ?? FUENTE[' '];
      glifo?.forEach((fila, gy) => {
        [...fila].forEach((bit, gx) => {
          if (bit !== '1') return;
          for (let dy = 0; dy < escala; dy++) {
            for (let dx = 0; dx < escala; dx++) {
              const x = 2 * escala + (i * 6 + gx) * escala + dx;
              const y = 2 * escala + (l * 9 + gy) * escala + dy;
              pixeles[y * (ancho + 1) + 1 + x] = 0;
            }
          }
        });
      });
    });
  });
  const trozo = (tipo: string, datos: Buffer) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc32(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // 8 bits, escala de grises, sin entrelazado
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', ihdr), trozo('IDAT', deflateSync(pixeles)), trozo('IEND', Buffer.alloc(0))]);
}

async function main(): Promise<void> {
  let fallas = 0;
  const marcar = (ok: boolean, texto: string, detalle = '') => {
    if (!ok) fallas++;
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}${detalle ? ` -> ${detalle}` : ''}`);
  };

  const escaneo = pngConTexto(['PAGINA ESCANEADA', 'NOVA LEE PDF']);
  const foto = pngConTexto(['NOVA LEE FOTOS', 'APUNTES DE CLASE']);
  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([400, 600]).drawText('Esta pagina tiene texto seleccionable desde el principio.', { x: 20, y: 500, size: 10, font: fuente });
  const imagen = await pdf.embedPng(escaneo);
  pdf.addPage([400, 600]).drawImage(imagen, { x: 0, y: 150, width: 400, height: 300 });
  pdf.addPage([400, 600]);
  const bytesPdf = await pdf.save();

  const extraido = await extraerPdf(bytesPdf.slice());
  marcar(JSON.stringify(extraido.escaneadas) === '[2]', 'detecta solo la página escaneada (no la de texto ni la en blanco)', JSON.stringify(extraido.escaneadas));

  // Las descargas de Blob se sirven desde la memoria.
  const archivos = new Map<string, Uint8Array>([
    ['https://prueba.public.blob.vercel-storage.com/libro.pdf', bytesPdf],
    ['https://prueba.public.blob.vercel-storage.com/foto.png', foto],
  ]);
  const original = globalThis.fetch;
  globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada instanceof Request ? entrada.url : entrada);
    const datos = archivos.get(url);
    return datos ? new Response(datos.slice()) : original(entrada, init);
  }) as typeof fetch;

  const base = { ocr: true as const, estado: 'leyendo' as const, leidas: [], etiquetas: null, indice: [], venceEn: new Date().toISOString() };
  await conClaveDelProyecto(async () => {
    const pdfLeido = await leerGrupoOcr({ ...base, fuente: 'pdf', urls: ['https://prueba.public.blob.vercel-storage.com/libro.pdf'], textos: extraido.paginas, porLeer: [2], total: 1 } satisfies LecturaOcr);
    const pagina = (pdfLeido.textos[1] ?? '').toUpperCase();
    marcar(pagina.includes('ESCANEADA') && pagina.includes('NOVA'), 'Gemini lee la página escaneada del PDF', JSON.stringify(pdfLeido.textos[1]));
    marcar(pdfLeido.porLeer.length === 0 && pdfLeido.leidas.join() === '2', 'queda marcada como leída con OCR');

    const fotoLeida = await leerGrupoOcr({ ...base, fuente: 'fotos', urls: ['https://prueba.public.blob.vercel-storage.com/foto.png'], textos: [''], porLeer: [1], total: 1 } satisfies LecturaOcr);
    const texto = (fotoLeida.textos[0] ?? '').toUpperCase();
    marcar(texto.includes('FOTOS') && texto.includes('APUNTES'), 'Gemini lee la foto', JSON.stringify(fotoLeida.textos[0]));
  });
  globalThis.fetch = original;

  console.log(`\nTotal de fallas: ${fallas}`);
  process.exitCode = fallas ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error('Error inesperado:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
