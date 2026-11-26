/**
 * Filtros y pestañas que se quedan en la misma pantalla (pedido del usuario del 2026-11-26): al tocarlos, la página no
 * debe subir. `scroll={false}` en el enlace no alcanza: al llegar la vista nueva, Next enfoca el primer elemento de la
 * página y eso la sube. Se anota dónde estaba la página y `ConservarScroll` (en el layout de Nova) la deja ahí cuando
 * la dirección cambia. Atrás y Adelante no pasan por aquí: los maneja el navegador.
 */

let pendiente: { destino: string; y: number; hasta: number } | null = null;

const normalizar = (url: string) => {
  const u = new URL(url, 'http://x');
  return `${u.pathname}${u.search}`;
};

/** Se llama al tocar el enlace (o antes de `router.replace`) con el destino. */
export function conservarScroll(destino: string): void {
  if (typeof window === 'undefined') return;
  pendiente = { destino: normalizar(destino), y: window.scrollY, hasta: Date.now() + 15_000 };
}

/** Lo que hay que restaurar para la dirección actual, una sola vez. */
export function tomarScrollPendiente(actual: string): number | null {
  if (!pendiente || Date.now() > pendiente.hasta) {
    pendiente = null;
    return null;
  }
  if (pendiente.destino !== normalizar(actual)) return null;
  const { y } = pendiente;
  pendiente = null;
  return y;
}
