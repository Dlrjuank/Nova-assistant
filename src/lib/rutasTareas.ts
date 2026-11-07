/**
 * Enlace a Tareas con el filtro de estado y el de categoría (null = "Todas"). Vive fuera de los componentes
 * de cliente porque lo usan tanto la página (servidor) como la fila de categorías (cliente).
 */
export function hrefTareas(estado: string | undefined, categoria: string | null): string {
  const parametros = new URLSearchParams();
  if (estado) parametros.set('estado', estado);
  if (categoria) parametros.set('categoria', categoria);
  const consulta = parametros.toString();
  return consulta ? `/nova/tareas?${consulta}` : '/nova/tareas';
}
