/**
 * E11b (PLAN_AMPLIACION 5.10, RB-62): qué se puede usar sin conexión en el navegador. El service worker
 * (public/sw-reglas.js) decide lo mismo para las páginas; una prueba comprueba que coinciden.
 */

export const NECESITAS_CONEXION = 'Necesitas conexión para esto.';
export const SIN_COPIA = 'Esta pantalla aún no está disponible sin conexión.';

/** Marca de un control que solo muestra (elegir un día, abrir "Más", cerrar un diálogo): sigue activo sin conexión. */
export const ATRIBUTO_PERMITIDO = 'data-sin-conexion';

const CAPITULOS = /^\/nova\/fuentes\/[0-9a-f-]{36}\/capitulos$/i;

/**
 * E11b: ¿el pedido falló por no tener internet (o no llegar al servidor)? `fetch` lo dice con un TypeError; una
 * respuesta que no se puede leer (por ejemplo, un error de configuración del servidor) es otro tipo de error.
 */
export function esFallaDeRed(error: unknown, enLinea: boolean = typeof navigator === 'undefined' ? true : navigator.onLine): boolean {
  return !enLinea || error instanceof TypeError;
}

/** "2026-11" del momento dado, en Bogotá. */
export function mesActualBogota(ahora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).format(ahora).slice(0, 7);
}

/** RB-62: Inicio, Tareas, el Calendario del mes actual y los capítulos de un documento tienen copia sin conexión. */
export function rutaConCopia(url: URL, ahora: Date): boolean {
  const ruta = url.pathname;
  if (ruta === '/nova' || ruta === '/nova/tareas') return true;
  if (ruta === '/nova/calendario') {
    const mes = url.searchParams.get('mes');
    return mes === null || mes === mesActualBogota(ahora);
  }
  return CAPITULOS.test(ruta);
}

/** `Sin conexión · datos de las {HH:MM}` con la hora (Bogotá) de la copia que se está viendo. */
export function textoSinConexion(guardadoEn: Date, formatearHora: (hhmm: string) => string = (h) => h): string {
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(guardadoEn);
  return `Sin conexión · datos de las ${formatearHora(hhmm)}`;
}

const CONTROLES = 'button, input, select, textarea, summary, [role="button"], [contenteditable="true"]';

/**
 * Sin conexión, ¿este elemento (o el control que lo contiene) queda desactivado? Los enlaces a pantallas con copia
 * y los controles marcados como "permitido" siguen activos; todo lo demás que lleva a otra pantalla, escribe datos
 * o necesita internet, no (RB-62).
 */
export function bloqueadoSinConexion(elemento: Element, origen: string, ahora: Date): boolean {
  if (elemento.closest(`[${ATRIBUTO_PERMITIDO}="permitido"]`)) return false;
  const enlace = elemento.closest('a[href]');
  if (enlace) {
    const url = new URL(enlace.getAttribute('href') as string, origen);
    return url.origin !== new URL(origen).origin || !rutaConCopia(url, ahora);
  }
  const control = elemento.closest(CONTROLES);
  if (control) return true;
  // Una etiqueta que activa un campo (casillas, opciones).
  const etiqueta = elemento.closest('label');
  return Boolean(etiqueta && (etiqueta.control || etiqueta.querySelector(CONTROLES)));
}
