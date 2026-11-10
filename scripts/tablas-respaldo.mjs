// Tablas de los respaldos, con los padres primero: la restauración inserta en este orden y el simulacro borra al revés.
// nova_config va primero porque el disparador de dueño por defecto (M5) la lee al insertar.
export const TABLAS_RESPALDO = [
  'nova_config',
  'categorias',
  'tareas_personales',
  'documentos',
  'fragmentos_pdf',
  'capitulos', // documentos y tareas_personales
  'fuentes_web',
  'conversaciones',
  'mensajes_chat',
];
