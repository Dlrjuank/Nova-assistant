export type CodigoError =
  | 'DATOS_INVALIDOS'
  | 'NO_AUTORIZADO'
  | 'ACCESO_DENEGADO'
  | 'PRIORIDAD_INVALIDA'
  | 'FECHA_INVALIDA'
  | 'ARCHIVO_MUY_GRANDE'
  | 'PDF_INVALIDO'
  | 'PDF_SIN_TEXTO'
  | 'PDF_MUY_LARGO'
  | 'CONSULTA_MUY_CORTA'
  | 'SIN_DOCUMENTOS'
  | 'ERROR_LLM'
  | 'TAREA_NO_ENCONTRADA'
  | 'TAREA_YA_COMPLETADA'
  | 'CONVERSACION_NO_ENCONTRADA'
  | 'DOCUMENTO_NO_ENCONTRADO'
  | 'MENSAJE_NO_ENCONTRADO'
  | 'LIMITE_FUENTES'
  | 'FUENTE_NO_ENCONTRADA'
  | 'FUENTE_DUPLICADA'
  | 'FUENTE_URL_INVALIDA'
  | 'ERROR_WIKIPEDIA'
  | 'CATEGORIA_NO_ENCONTRADA'
  | 'CATEGORIA_DUPLICADA'
  | 'COLOR_INVALIDO'
  | 'NOMBRE_CATEGORIA_INVALIDO'
  | 'CATEGORIA_GENERAL'
  | 'HORA_INVALIDA'
  | 'HORA_FIN_SIN_INICIO'
  | 'HORA_FIN_ANTES'
  | 'PLAN_FECHAS_INVERTIDAS'
  | 'CAPITULO_EN_TAREAS'
  | 'ERROR_INTERNO';

// Textos de la sección 12.2; los de la sección 5.1 se usan literalmente.
export const MENSAJES: Record<CodigoError, string> = {
  DATOS_INVALIDOS: 'Revise los datos ingresados.',
  NO_AUTORIZADO: 'Debe iniciar sesión.',
  ACCESO_DENEGADO: 'Su cuenta no tiene acceso a Nova Assistant.',
  PRIORIDAD_INVALIDA: 'La prioridad debe ser 1, 2 o 3',
  FECHA_INVALIDA: 'La fecha debe tener formato AAAA-MM-DD y ser una fecha real.',
  ARCHIVO_MUY_GRANDE: 'El documento supera el límite permitido de 15 MB',
  PDF_INVALIDO: 'El archivo no es un PDF válido.',
  PDF_SIN_TEXTO: 'El documento no contiene texto seleccionable (no se admite OCR)',
  CONSULTA_MUY_CORTA: 'La instrucción es demasiado corta',
  SIN_DOCUMENTOS: 'Aún no hay documentos indexados. Indexe un PDF antes de preguntar.',
  PDF_MUY_LARGO: 'El PDF tiene demasiadas páginas; el máximo es 800.',
  ERROR_LLM: 'No se pudo obtener respuesta del asistente. Intenta de nuevo.',
  TAREA_NO_ENCONTRADA: 'La tarea no existe.',
  TAREA_YA_COMPLETADA: 'La tarea ya está completada.',
  CONVERSACION_NO_ENCONTRADA: 'La conversación no existe. Recargue la página.',
  DOCUMENTO_NO_ENCONTRADO: 'El documento no existe.',
  MENSAJE_NO_ENCONTRADO: 'Esa respuesta ya no se puede explicar de otra manera.',
  FUENTE_NO_ENCONTRADA: 'La fuente no existe.',
  FUENTE_DUPLICADA: 'Esta fuente ya está guardada en esta categoría.',
  FUENTE_URL_INVALIDA: 'La dirección de la fuente no es válida.',
  LIMITE_FUENTES: 'Alcanzó el máximo de 20 fuentes en esta categoría; archive o elimine una.',
  ERROR_WIKIPEDIA: 'No se pudo consultar Wikipedia. Intente de nuevo.',
  // PLAN_AMPLIACION sección 8 (RB-02 a RB-04), en tuteo como el resto de la app.
  CATEGORIA_NO_ENCONTRADA: 'La categoría no existe.',
  CATEGORIA_DUPLICADA: 'Ya existe una categoría con ese nombre.',
  COLOR_INVALIDO: 'Elige un color de la lista.',
  NOMBRE_CATEGORIA_INVALIDO: 'Escribe un nombre de 1 a 80 caracteres.',
  CATEGORIA_GENERAL: 'La categoría General no se puede eliminar.',
  // RB-34 (E06b): horario opcional de una tarea.
  HORA_INVALIDA: 'La hora debe tener formato HH:MM de 24 horas.',
  HORA_FIN_SIN_INICIO: 'La hora de fin necesita una hora de inicio.',
  HORA_FIN_ANTES: 'La hora de fin debe ser después de la de inicio.',
  // RB-42 (E10d): plan de lectura.
  PLAN_FECHAS_INVERTIDAS: 'La fecha final debe ser igual o posterior a la de inicio.',
  CAPITULO_EN_TAREAS: 'Este capítulo ya está en Tareas.',
  ERROR_INTERNO: 'Ocurrió un error inesperado. Intente de nuevo.',
};

export const ESTADO_HTTP: Record<CodigoError, number> = {
  DATOS_INVALIDOS: 400,
  NO_AUTORIZADO: 401,
  ACCESO_DENEGADO: 403,
  PRIORIDAD_INVALIDA: 422,
  FECHA_INVALIDA: 422,
  ARCHIVO_MUY_GRANDE: 413,
  PDF_INVALIDO: 422,
  PDF_SIN_TEXTO: 422,
  CONSULTA_MUY_CORTA: 422,
  SIN_DOCUMENTOS: 409,
  PDF_MUY_LARGO: 422,
  ERROR_LLM: 502,
  TAREA_NO_ENCONTRADA: 404,
  TAREA_YA_COMPLETADA: 409,
  CONVERSACION_NO_ENCONTRADA: 404,
  DOCUMENTO_NO_ENCONTRADO: 404,
  MENSAJE_NO_ENCONTRADO: 404,
  LIMITE_FUENTES: 409,
  FUENTE_NO_ENCONTRADA: 404,
  FUENTE_DUPLICADA: 409,
  FUENTE_URL_INVALIDA: 422,
  ERROR_WIKIPEDIA: 502,
  CATEGORIA_NO_ENCONTRADA: 404,
  CATEGORIA_DUPLICADA: 409,
  COLOR_INVALIDO: 422,
  NOMBRE_CATEGORIA_INVALIDO: 422,
  CATEGORIA_GENERAL: 409,
  HORA_INVALIDA: 422,
  HORA_FIN_SIN_INICIO: 422,
  HORA_FIN_ANTES: 422,
  PLAN_FECHAS_INVERTIDAS: 422,
  CAPITULO_EN_TAREAS: 409,
  ERROR_INTERNO: 500,
};

export class ErrorDeNegocio extends Error {
  constructor(
    public codigo: CodigoError,
    mensaje?: string,
    public detalles?: unknown,
  ) {
    super(mensaje ?? MENSAJES[codigo]);
    this.name = 'ErrorDeNegocio';
  }
}
