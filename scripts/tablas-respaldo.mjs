// Tablas de los respaldos, con los padres primero: la restauración inserta en este orden y el simulacro borra al revés.
// nova_config va primero porque el disparador de dueño por defecto (M5) la lee al insertar.
export const TABLAS_RESPALDO = [
  'nova_config',
  'categorias',
  'preferencias_usuario', // M7 (E11)
  'tareas_personales',
  'documentos',
  'fragmentos_pdf',
  'capitulos', // documentos y tareas_personales
  // M17 (E10e): cuestionarios y sus intentos
  'cuestionarios', // documentos y capitulos
  'preguntas_cuestionario',
  'intentos_cuestionario', // repaso_de apunta a la misma tabla: se inserta en una sola sentencia
  'respuestas_intento', // intentos_cuestionario y preguntas_cuestionario
  'fuentes_web',
  'conversaciones',
  'mensajes_chat',
];
