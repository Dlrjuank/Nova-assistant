// @vitest-environment node
// Corrección de E11b: la app instalada en el iPhone abre con el fondo de Nova y su ícono, no en negro.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { archivoArranque, imagenesArranque, mediaArranque, PANTALLAS_IPHONE } from '@/lib/arranque';
import { manifiesto } from '@/lib/manifiesto';
import { COLOR_FONDO } from '@/lib/tema';

/** Ancho, alto y color del primer píxel de un PNG (RGB o RGBA de 8 bits). */
function leerPng(ruta: string) {
  const b = readFileSync(ruta);
  const ancho = b.readUInt32BE(16);
  const alto = b.readUInt32BE(20);
  const canales = b[25] === 6 ? 4 : 3;
  const datos: Buffer[] = [];
  for (let i = 8; i < b.length; ) {
    const largo = b.readUInt32BE(i);
    if (b.toString('ascii', i + 4, i + 8) === 'IDAT') datos.push(b.subarray(i + 8, i + 8 + largo));
    i += 12 + largo;
  }
  const crudo = inflateSync(Buffer.concat(datos));
  // Primera fila: byte de filtro y luego el primer píxel (con filtro 0 o 1 el primer píxel queda tal cual).
  const hex = [...crudo.subarray(1, 1 + 3)].map((n) => n.toString(16).padStart(2, '0')).join('');
  return { ancho, alto, canales, color: `#${hex}` };
}

describe('pantallas de arranque del iPhone', () => {
  it('una imagen por tamaño de iPhone, en claro y oscuro, del tamaño exacto en píxeles y con el fondo de Nova', () => {
    for (const p of PANTALLAS_IPHONE) {
      for (const modo of ['claro', 'oscuro'] as const) {
        const ruta = join(process.cwd(), 'public', archivoArranque(p, modo));
        expect(existsSync(ruta), ruta).toBe(true);
        const png = leerPng(ruta);
        expect([png.ancho, png.alto]).toEqual([p.ancho * p.escala, p.alto * p.escala]);
        expect(png.color).toBe(COLOR_FONDO[modo]);
      }
    }
  });

  it('cada etiqueta lleva la consulta exacta que usa iOS, y el tema del sistema', () => {
    const iphone15 = PANTALLAS_IPHONE.find((p) => p.ancho === 393 && p.alto === 852);
    expect(iphone15).toBeDefined();
    expect(mediaArranque(iphone15!, 'oscuro')).toBe(
      'screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)',
    );
    const imagenes = imagenesArranque();
    expect(imagenes).toHaveLength(PANTALLAS_IPHONE.length * 2);
    expect(new Set(imagenes.map((i) => i.media)).size).toBe(imagenes.length); // ninguna se repite
  });

  it('el manifiesto (Android) arranca con el fondo de Nova', () => {
    expect(manifiesto().background_color).toBe(COLOR_FONDO.claro);
    expect(manifiesto().theme_color).toBe(COLOR_FONDO.claro);
  });
});
