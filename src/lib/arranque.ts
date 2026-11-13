/**
 * Pantallas de arranque de la app instalada en el iPhone (corrección de E11b). iOS no usa el `background_color`
 * del manifiesto: mientras llega la primera respuesta del servidor muestra una imagen `apple-touch-startup-image`
 * del tamaño exacto de la pantalla, o negro si no la tiene. Por eso hay una por tamaño de iPhone, en claro y en
 * oscuro (según el tema del sistema: antes de abrir, la app todavía no sabe el tema elegido en Nova).
 * Las imágenes están en public/icons/arranque/ (fondo de Nova con el ícono al centro).
 */
export interface PantallaIphone {
  /** Ancho y alto en puntos (CSS), en vertical. */
  ancho: number;
  alto: number;
  escala: 2 | 3;
}

/** Tamaños de pantalla de los iPhone con iOS 16 o más, en vertical. */
export const PANTALLAS_IPHONE: readonly PantallaIphone[] = [
  { ancho: 440, alto: 956, escala: 3 }, // 16 Pro Max, 17 Pro Max
  { ancho: 430, alto: 932, escala: 3 }, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { ancho: 428, alto: 926, escala: 3 }, // 12 Pro Max, 13 Pro Max, 14 Plus
  { ancho: 420, alto: 912, escala: 3 }, // Air
  { ancho: 414, alto: 896, escala: 3 }, // XS Max, 11 Pro Max
  { ancho: 414, alto: 896, escala: 2 }, // XR, 11
  { ancho: 414, alto: 736, escala: 3 }, // 8 Plus
  { ancho: 402, alto: 874, escala: 3 }, // 16 Pro, 17, 17 Pro
  { ancho: 393, alto: 852, escala: 3 }, // 14 Pro, 15, 15 Pro, 16
  { ancho: 390, alto: 844, escala: 3 }, // 12, 13, 14, 16e
  { ancho: 375, alto: 812, escala: 3 }, // X, XS, 11 Pro, 12 mini, 13 mini
  { ancho: 375, alto: 667, escala: 2 }, // 8, SE (2.ª y 3.ª)
  { ancho: 320, alto: 568, escala: 2 }, // SE (1.ª)
];

export type ModoArranque = 'claro' | 'oscuro';

/** Nombre del archivo: arranque-1290x2796-claro.png (tamaño en píxeles). */
export function archivoArranque(p: PantallaIphone, modo: ModoArranque): string {
  return `/icons/arranque/arranque-${p.ancho * p.escala}x${p.alto * p.escala}-${modo}.png`;
}

/** La consulta exacta con la que iOS elige la imagen. */
export function mediaArranque(p: PantallaIphone, modo: ModoArranque): string {
  return (
    `screen and (device-width: ${p.ancho}px) and (device-height: ${p.alto}px) and (-webkit-device-pixel-ratio: ${p.escala}) ` +
    `and (orientation: portrait) and (prefers-color-scheme: ${modo === 'claro' ? 'light' : 'dark'})`
  );
}

/** Para `metadata.appleWebApp.startupImage`. */
export function imagenesArranque(): { url: string; media: string }[] {
  return PANTALLAS_IPHONE.flatMap((p) => (['claro', 'oscuro'] as const).map((modo) => ({ url: archivoArranque(p, modo), media: mediaArranque(p, modo) })));
}
