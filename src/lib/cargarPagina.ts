/**
 * E11e: abre una pantalla con una carga completa del navegador (no con la navegación de Next). Sin conexión, el
 * service worker la sirve desde su copia; la navegación de Next sin red a veces no cambia de pantalla. Aparte para
 * que las pruebas la puedan reemplazar (jsdom no navega).
 */
export function cargarPagina(url: string): void {
  marcarSalida();
  window.location.assign(url);
}

let saliendo = false;

/** La página empezó a irse (a otra pantalla o recargándose). */
export function marcarSalida(): void {
  saliendo = true;
}

/** Volvió desde la caché de atrás/adelante del navegador: ya no se está yendo. */
export function reiniciarSalida(): void {
  saliendo = false;
}

/** ¿Ya se está yendo? Entonces no hay que recargarla ni navegar otra vez. */
export function saliendoDePagina(): boolean {
  return saliendo;
}
