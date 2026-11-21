import { formatearMinutos } from '@/lib/formato';

/**
 * E20b (commit 3): la pequeña celebración al completar una tarea. Se avisa con un evento de la ventana para que
 * el aviso viva en el layout de Nova y no desaparezca cuando la fila completada cambia de lugar o de pestaña
 * con `router.refresh()`. Sin 'use client': las reglas de texto también se prueban solas.
 */
export const EVENTO_CELEBRAR = 'nova-celebrar';

export interface Celebracion {
  titulo: string;
  minutos: number;
}

/** Línea bajo "¡Tarea completada!": el título y, si registró tiempo, los minutos. */
export function detalleCelebracion({ titulo, minutos }: Celebracion): string {
  const limpio = titulo.trim();
  return minutos > 0 ? `${limpio} · ${formatearMinutos(minutos)}` : limpio;
}

export function celebrar(detalle: Celebracion): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<Celebracion>(EVENTO_CELEBRAR, { detail: detalle }));
}
