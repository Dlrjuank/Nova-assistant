// Tablas de los respaldos, con los padres primero: la restauración inserta en este orden y el simulacro borra al revés.
// nova_config va primero porque el disparador de dueño por defecto (M5) la lee al insertar.
export const TABLAS_RESPALDO = [
  'nova_config',
  // M25 (E20c-2): cuentas con su nivel y estado, los topes y el registro de acciones (sin FK a las cuentas)
  'cuentas',
  'administracion',
  'acciones_admin',
  'categorias',
  'preferencias_usuario', // M7 (E11)
  'tareas_personales',
  'metas_semanales', // M10 (E15)
  // M8 (E12): Semestre; documentos.materia_id apunta a materias
  'materias',
  'cortes',
  'componentes',
  'notas',
  'metas_nota', // M11 (E16): materias y cortes
  'temas', // M12 (E17): cortes
  // M13 (E18): plan de estudio de un corte
  'planes_estudio', // cortes
  'versiones_plan',
  'documentos',
  'fragmentos_pdf',
  'capitulos', // documentos y tareas_personales
  'pasos_en_tareas', // M13 (E19): planes_estudio y tareas_personales
  // M17 (E10e): cuestionarios y sus intentos
  'cuestionarios', // documentos y capitulos
  'preguntas_cuestionario',
  'intentos_cuestionario', // repaso_de apunta a la misma tabla: se inserta en una sola sentencia
  'respuestas_intento', // intentos_cuestionario y preguntas_cuestionario
  // M16 (E11c): suscripciones push y registro de envíos
  'suscripciones_push',
  'envios', // tareas_personales
  'fuentes_web',
  'conversaciones',
  'mensajes_chat',
  // M24 (E20c-1): la clave de Gemini va cifrada (sin NOVA_LLAVE_CLAVES_V{n} no sirve de nada) y el uso solo en conteos
  'claves_gemini',
  'uso_ia_diario',
];
