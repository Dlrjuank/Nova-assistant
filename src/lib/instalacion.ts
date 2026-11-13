/**
 * E11b (5.10): el aviso "Instalar" de Chrome en Android llega una sola vez y en cualquier pantalla. Se guarda
 * aquí para que Configuración → "Instalar Nova" pueda ofrecer el botón. Solo se usa en el navegador.
 */
export interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pendiente: EventoInstalar | null = null;
const oyentes = new Set<() => void>();

export function guardarEventoInstalar(evento: EventoInstalar | null): void {
  pendiente = evento;
  oyentes.forEach((o) => o());
}

export function eventoInstalar(): EventoInstalar | null {
  return pendiente;
}

export function alCambiarInstalar(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Abierta como app (agregada a inicio): pantalla completa, sin la barra del navegador. */
export function abiertaComoApp(): boolean {
  if (typeof window === 'undefined') return false;
  const iphone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iphone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** iPhone o iPad (también el iPad que se presenta como Mac). */
export function esIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
}
