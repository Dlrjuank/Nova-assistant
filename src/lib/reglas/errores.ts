export type CodigoError =
  | 'DATOS_INVALIDOS'
  | 'NO_AUTORIZADO'
  | 'ACCESO_DENEGADO'
  | 'PRIORIDAD_INVALIDA'
  | 'FECHA_INVALIDA'
  | 'ARCHIVO_MUY_GRANDE'
  | 'PDF_INVALIDO'
  | 'PDF_SIN_TEXTO'
  | 'CONSULTA_MUY_CORTA'
  | 'SIN_DOCUMENTOS'
  | 'ERROR_LLM'
  | 'TAREA_NO_ENCONTRADA'
  | 'TAREA_YA_COMPLETADA'
  | 'CONVERSACION_NO_ENCONTRADA'
  | 'DOCUMENTO_NO_ENCONTRADO'
  | 'LIMITE_FUENTES'
  | 'ERROR_WIKIPEDIA'
  | 'CATEGORIA_NO_ENCONTRADA'
  | 'CATEGORIA_DUPLICADA'
  | 'COLOR_INVALIDO'
  | 'NOMBRE_CATEGORIA_INVALIDO'
  | 'CATEGORIA_GENERAL'
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
  ERROR_LLM: 'No se pudo obtener respuesta del asistente. Intente de nuevo.',
  TAREA_NO_ENCONTRADA: 'La tarea no existe.',
  TAREA_YA_COMPLETADA: 'La tarea ya está completada.',
  CONVERSACION_NO_ENCONTRADA: 'La conversación no existe. Recargue la página.',
  DOCUMENTO_NO_ENCONTRADO: 'El documento no existe.',
  LIMITE_FUENTES: 'Alcanzó el máximo de 20 fuentes en esta categoría; archive o elimine una.',
  ERROR_WIKIPEDIA: 'No se pudo consultar Wikipedia. Intente de nuevo.',
  // PLAN_AMPLIACION sección 8 (RB-02 a RB-04), en tuteo como el resto de la app.
  CATEGORIA_NO_ENCONTRADA: 'La categoría no existe.',
  CATEGORIA_DUPLICADA: 'Ya existe una categoría con ese nombre.',
  COLOR_INVALIDO: 'Elige un color de la lista.',
  NOMBRE_CATEGORIA_INVALIDO: 'Escribe un nombre de 1 a 80 caracteres.',
  CATEGORIA_GENERAL: 'La categoría General no se puede eliminar.',
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
  ERROR_LLM: 502,
  TAREA_NO_ENCONTRADA: 404,
  TAREA_YA_COMPLETADA: 409,
  CONVERSACION_NO_ENCONTRADA: 404,
  DOCUMENTO_NO_ENCONTRADO: 404,
  LIMITE_FUENTES: 409,
  ERROR_WIKIPEDIA: 502,
  CATEGORIA_NO_ENCONTRADA: 404,
  CATEGORIA_DUPLICADA: 409,
  COLOR_INVALIDO: 422,
  NOMBRE_CATEGORIA_INVALIDO: 422,
  CATEGORIA_GENERAL: 409,
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
