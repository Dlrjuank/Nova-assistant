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
  | 'DOCUMENTO_SIN_PAGINAS'
  | 'DOCUMENTO_INDEXANDO'
  | 'RANGO_PAGINAS_INVALIDO'
  | 'CONTENIDO_INSUFICIENTE'
  | 'CUOTA_AGOTADA'
  | 'CUESTIONARIO_NO_ENCONTRADO'
  | 'PREGUNTA_NO_ENCONTRADA'
  | 'TAREA_REPASO_EXISTENTE'
  | 'NOMBRE_PERFIL_INVALIDO'
  | 'NOTA_APROBAR_INVALIDA'
  | 'PORCENTAJE_INVALIDO'
  | 'CORTES_NO_SUMAN'
  | 'RECORDATORIO_INVALIDO'
  | 'HORA_RECORDATORIO_INVALIDA'
  | 'HORA_RESUMEN_INVALIDA'
  | 'SUSCRIPCION_INVALIDA'
  | 'SIN_NOTIFICACIONES'
  | 'NOTIFICACIONES_NO_CONFIGURADAS'
  | 'MATERIA_NO_ENCONTRADA'
  | 'CORTE_NO_ENCONTRADO'
  | 'COMPONENTE_NO_ENCONTRADO'
  | 'NOTA_NO_ENCONTRADA'
  | 'MATERIA_DUPLICADA'
  | 'NOMBRE_MATERIA_INVALIDO'
  | 'CREDITOS_INVALIDOS'
  | 'NOMBRE_CORTE_INVALIDO'
  | 'NOMBRE_COMPONENTE_INVALIDO'
  | 'COMPONENTE_DUPLICADO'
  | 'NOMBRE_NOTA_INVALIDO'
  | 'NOTA_INVALIDA'
  | 'QUITAR_CORTES_INVALIDO'
  | 'SIN_CORTES'
  | 'META_INVALIDA'
  | 'FALLAS_INVALIDAS'
  | 'LIMITE_FALLAS'
  | 'FALLAS_SOBRE_LIMITE'
  | 'OBJETIVO_INVALIDO'
  | 'META_SEMANAL_DUPLICADA'
  | 'META_SEMANAL_NO_ENCONTRADA'
  | 'META_NO_ENCONTRADA'
  | 'TEMA_NOMBRE_INVALIDO'
  | 'TEMA_DUPLICADO'
  | 'TEMA_NO_ENCONTRADO'
  | 'PLAN_SIN_FECHA'
  | 'SIN_SYLLABUS'
  | 'SIN_TEMAS_PROPUESTOS'
  | 'SIN_TEMAS_CONFIRMADOS'
  | 'PLAN_INVALIDO'
  | 'PLAN_NO_ENCONTRADO'
  | 'VERSION_NO_ENCONTRADA'
  | 'PASO_TITULO_INVALIDO'
  | 'PASO_MINUTOS_INVALIDOS'
  | 'PASO_FECHA_INVALIDA'
  | 'PASO_TEMA_INVALIDO'
  | 'PLAN_SIN_PASOS'
  | 'PLAN_MUY_LARGO'
  | 'PASO_NO_ENCONTRADO'
  | 'PASO_YA_EN_TAREAS'
  | 'ERROR_INTERNO';

// Textos de la sección 12.2; los de la sección 5.1 se usan literalmente.
export const MENSAJES: Record<CodigoError, string> = {
  DATOS_INVALIDOS: 'Revisa los datos ingresados.',
  NO_AUTORIZADO: 'Debes iniciar sesión.',
  ACCESO_DENEGADO: 'Tu cuenta no tiene acceso a Nova Assistant.',
  PRIORIDAD_INVALIDA: 'La prioridad debe ser 1, 2 o 3',
  FECHA_INVALIDA: 'La fecha debe tener formato AAAA-MM-DD y ser una fecha real.',
  ARCHIVO_MUY_GRANDE: 'El documento supera el límite permitido de 15 MB',
  PDF_INVALIDO: 'El archivo no es un PDF válido.',
  PDF_SIN_TEXTO: 'El documento no contiene texto seleccionable (no se admite OCR)',
  CONSULTA_MUY_CORTA: 'La instrucción es demasiado corta',
  SIN_DOCUMENTOS: 'Aún no hay documentos indexados. Indexa un PDF antes de preguntar.',
  PDF_MUY_LARGO: 'El PDF tiene demasiadas páginas; el máximo es 800.',
  ERROR_LLM: 'No se pudo obtener respuesta del asistente. Intenta de nuevo.',
  TAREA_NO_ENCONTRADA: 'La tarea no existe.',
  TAREA_YA_COMPLETADA: 'La tarea ya está completada.',
  CONVERSACION_NO_ENCONTRADA: 'La conversación no existe. Recarga la página.',
  DOCUMENTO_NO_ENCONTRADO: 'El documento no existe.',
  MENSAJE_NO_ENCONTRADO: 'Esa respuesta ya no se puede explicar de otra manera.',
  FUENTE_NO_ENCONTRADA: 'La fuente no existe.',
  FUENTE_DUPLICADA: 'Esta fuente ya está guardada en esta categoría.',
  FUENTE_URL_INVALIDA: 'La dirección de la fuente no es válida.',
  LIMITE_FUENTES: 'Alcanzaste el máximo de 20 fuentes en esta categoría; archiva o elimina una.',
  ERROR_WIKIPEDIA: 'No se pudo consultar Wikipedia. Intenta de nuevo.',
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
  // RB-48 a RB-52 (E10e): cuestionarios.
  DOCUMENTO_SIN_PAGINAS: 'Vuelve a indexar este documento para ver páginas y capítulos.',
  DOCUMENTO_INDEXANDO: 'Espera a que este documento termine de indexarse.',
  RANGO_PAGINAS_INVALIDO: 'El rango de páginas no es válido.',
  CONTENIDO_INSUFICIENTE: 'Este contenido no alcanza para un cuestionario. Elige más páginas o menos preguntas.',
  CUOTA_AGOTADA: 'Se agotó por ahora el cupo gratuito de Gemini. Intenta más tarde.',
  CUESTIONARIO_NO_ENCONTRADO: 'El cuestionario no existe.',
  PREGUNTA_NO_ENCONTRADA: 'La pregunta no existe.',
  // RB-53 (E10f): sugerencia de repaso.
  TAREA_REPASO_EXISTENTE: 'Ya tienes esa tarea de repaso.',
  // E11 (RB-26, RB-11, RB-10, RB-07): Configuración.
  NOMBRE_PERFIL_INVALIDO: 'Escribe tu nombre.',
  NOTA_APROBAR_INVALIDA: 'La nota para aprobar debe estar entre 0,0 y 5,0.',
  PORCENTAJE_INVALIDO: 'El porcentaje debe ser mayor que 0 y como máximo 100.',
  CORTES_NO_SUMAN: 'Los porcentajes de los cortes deben sumar 100 %.',
  // E11c (RB-43, RB-45): recordatorios y notificaciones.
  RECORDATORIO_INVALIDO: 'Ese recordatorio necesita la hora de inicio de la tarea.',
  HORA_RECORDATORIO_INVALIDA: 'Elige una hora válida para los recordatorios.',
  HORA_RESUMEN_INVALIDA: 'Elige una hora válida para el resumen.',
  SUSCRIPCION_INVALIDA: 'No se pudieron activar las notificaciones en este dispositivo. Intenta de nuevo.',
  SIN_NOTIFICACIONES: 'Activa las notificaciones para recibir este aviso.',
  NOTIFICACIONES_NO_CONFIGURADAS: 'Las notificaciones todavía no están disponibles en este servidor.',
  // E12 (RB-05, RB-06, RB-09, RB-35): Semestre.
  MATERIA_NO_ENCONTRADA: 'La materia no existe.',
  CORTE_NO_ENCONTRADO: 'El corte no existe.',
  COMPONENTE_NO_ENCONTRADO: 'El componente no existe.',
  NOTA_NO_ENCONTRADA: 'La nota no existe.',
  MATERIA_DUPLICADA: 'Ya existe una materia con ese nombre.',
  NOMBRE_MATERIA_INVALIDO: 'Escribe el nombre de la materia (hasta 80 caracteres).',
  CREDITOS_INVALIDOS: 'Los créditos deben ser un número entero entre 1 y 10.',
  NOMBRE_CORTE_INVALIDO: 'Escribe el nombre del corte (hasta 40 caracteres).',
  NOMBRE_COMPONENTE_INVALIDO: 'Escribe el nombre del componente (hasta 80 caracteres).',
  COMPONENTE_DUPLICADO: 'Ya existe un componente con ese nombre.',
  NOMBRE_NOTA_INVALIDO: 'El nombre de la nota puede tener hasta 120 caracteres.',
  NOTA_INVALIDA: 'La nota debe estar entre 0,0 y 5,0.',
  QUITAR_CORTES_INVALIDO: 'Para quitar los cortes, deja solo uno.',
  SIN_CORTES: 'La materia debe tener al menos un corte.',
  META_INVALIDA: 'La meta debe estar entre 0,1 y 5,0.',
  FALLAS_INVALIDAS: 'Las fallas deben ser un número entero mayor o igual a 0.',
  LIMITE_FALLAS: 'Llegaste al límite de fallas de esta materia: no puedes sumar más.', // E20 (ajuste)
  FALLAS_SOBRE_LIMITE: 'Las fallas registradas no pueden pasar del límite.', // E20 (ajuste)
  OBJETIVO_INVALIDO: 'El objetivo debe ser un número entero mayor que 0.', // RB-16
  META_SEMANAL_DUPLICADA: 'Ya tienes una meta igual.', // RB-17
  META_SEMANAL_NO_ENCONTRADA: 'La meta no existe.',
  META_NO_ENCONTRADA: 'La meta no existe.',
  TEMA_NOMBRE_INVALIDO: 'Escribe un tema de 1 a 200 caracteres.',
  TEMA_DUPLICADO: 'Ese tema ya está en este corte.',
  TEMA_NO_ENCONTRADO: 'El tema no existe.',
  PLAN_SIN_FECHA: 'Pon una fecha futura al corte para generar el plan.', // RB-19 (los temas usan su propio texto)
  SIN_SYLLABUS: 'Sube un PDF de esta materia (por ejemplo, el syllabus) para proponer temas.', // RB-21
  SIN_TEMAS_PROPUESTOS: 'No encontré temas nuevos en ese PDF. Prueba con otro o agrégalos a mano.',
  // E18 (9.2 a 9.4)
  SIN_TEMAS_CONFIRMADOS: 'Primero confirma al menos un tema del corte.', // RB-20
  PLAN_INVALIDO: 'El plan generado no cumplía las reglas y se descartó. Intenta de nuevo.', // RB-22
  PLAN_NO_ENCONTRADO: 'Este corte aún no tiene plan de estudio.',
  VERSION_NO_ENCONTRADA: 'Esa versión del plan no existe.',
  PASO_TITULO_INVALIDO: 'Escribe un paso de 1 a 120 caracteres.',
  PASO_MINUTOS_INVALIDOS: 'Los minutos van de 15 a 240.',
  PASO_FECHA_INVALIDA: 'La fecha del paso debe estar entre hoy y la fecha del corte.',
  PASO_TEMA_INVALIDO: 'Elige un tema confirmado del corte.',
  PLAN_SIN_PASOS: 'El plan debe tener al menos un paso.',
  PLAN_MUY_LARGO: 'El plan puede tener como máximo 60 pasos.',
  // E19 (9.5)
  PASO_NO_ENCONTRADO: 'Ese paso ya no está en el plan vigente.',
  PASO_YA_EN_TAREAS: 'Este paso ya está en Tareas.', // RB-24
  ERROR_INTERNO: 'Ocurrió un error inesperado. Intenta de nuevo.',
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
  DOCUMENTO_SIN_PAGINAS: 422,
  DOCUMENTO_INDEXANDO: 409,
  RANGO_PAGINAS_INVALIDO: 422,
  CONTENIDO_INSUFICIENTE: 422,
  CUOTA_AGOTADA: 429,
  CUESTIONARIO_NO_ENCONTRADO: 404,
  PREGUNTA_NO_ENCONTRADA: 404,
  TAREA_REPASO_EXISTENTE: 409,
  NOMBRE_PERFIL_INVALIDO: 422,
  NOTA_APROBAR_INVALIDA: 422,
  PORCENTAJE_INVALIDO: 422,
  CORTES_NO_SUMAN: 422,
  RECORDATORIO_INVALIDO: 422,
  HORA_RECORDATORIO_INVALIDA: 422,
  HORA_RESUMEN_INVALIDA: 422,
  SUSCRIPCION_INVALIDA: 422,
  SIN_NOTIFICACIONES: 409,
  NOTIFICACIONES_NO_CONFIGURADAS: 503,
  MATERIA_NO_ENCONTRADA: 404,
  CORTE_NO_ENCONTRADO: 404,
  COMPONENTE_NO_ENCONTRADO: 404,
  NOTA_NO_ENCONTRADA: 404,
  MATERIA_DUPLICADA: 409,
  NOMBRE_MATERIA_INVALIDO: 422,
  CREDITOS_INVALIDOS: 422,
  NOMBRE_CORTE_INVALIDO: 422,
  NOMBRE_COMPONENTE_INVALIDO: 422,
  COMPONENTE_DUPLICADO: 409,
  NOMBRE_NOTA_INVALIDO: 422,
  NOTA_INVALIDA: 422,
  QUITAR_CORTES_INVALIDO: 409,
  SIN_CORTES: 409,
  META_INVALIDA: 422,
  FALLAS_INVALIDAS: 422,
  LIMITE_FALLAS: 409,
  FALLAS_SOBRE_LIMITE: 422,
  OBJETIVO_INVALIDO: 422,
  META_SEMANAL_DUPLICADA: 409,
  META_SEMANAL_NO_ENCONTRADA: 404,
  META_NO_ENCONTRADA: 404,
  TEMA_NOMBRE_INVALIDO: 422,
  TEMA_DUPLICADO: 409,
  TEMA_NO_ENCONTRADO: 404,
  PLAN_SIN_FECHA: 422,
  SIN_SYLLABUS: 422,
  SIN_TEMAS_PROPUESTOS: 422,
  SIN_TEMAS_CONFIRMADOS: 422,
  PLAN_INVALIDO: 422,
  PLAN_NO_ENCONTRADO: 404,
  VERSION_NO_ENCONTRADA: 404,
  PASO_TITULO_INVALIDO: 422,
  PASO_MINUTOS_INVALIDOS: 422,
  PASO_FECHA_INVALIDA: 422,
  PASO_TEMA_INVALIDO: 422,
  PLAN_SIN_PASOS: 422,
  PLAN_MUY_LARGO: 422,
  PASO_NO_ENCONTRADO: 404,
  PASO_YA_EN_TAREAS: 409,
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
