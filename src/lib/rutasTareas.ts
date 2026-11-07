/**
 * Enlace a Tareas con la vista (pestaña, E08) y el filtro de categoría (null = "Todas"). Vive fuera de los
 * componentes de cliente porque lo usan tanto la página (servidor) como la fila de categorías (cliente).
 * "todas" es la vista por defecto y no va en la URL.
 */
export function hrefTareas(vista: string | undefined, categoria: string | null): string {
  const parametros = new URLSearchParams();
  if (vista && vista !== 'todas') parametros.set('vista', vista);
  if (categoria) parametros.set('categoria', categoria);
  const consulta = parametros.toString();
  return consulta ? `/nova/tareas?${consulta}` : '/nova/tareas';
}
