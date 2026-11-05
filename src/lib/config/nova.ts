// Constantes de Nova Assistant (plan sección 10.4)
export const PDF_MAX_BYTES = 15_728_640; // 15 MB exactos (RN-01)
export const FRAGMENTO_PALABRAS = 500; // RN-10
export const FRAGMENTO_SOLAPAMIENTO = 50; // RN-10
export const CONSULTA_MIN_PALABRAS = 2; // RN-02
export const CONSULTA_MIN_CARACTERES = 8; // RN-02
export const CONSULTA_MAX_CARACTERES = 1000; // evita gastar cuota de Gemini en textos enormes
export const FRAGMENTOS_RECUPERADOS = 4; // RN-12
export const EMBEDDING_DIMENSIONES = 768; // gemini-embedding-001 con outputDimensionality (sección 2.1)
export const PRIORIDAD_POR_DEFECTO = 2; // RN-04
export const CATEGORIA_POR_DEFECTO = 'General';
export const MINUTOS_TOPE_INDICE = 120; // RN-03
export const MAX_FUENTES_WEB_POR_CATEGORIA = 20; // RN-05 (F4)
export const ZONA_HORARIA = 'America/Bogota';
export const LIMITE_LISTADO = 500;

// Modelos de Gemini (se pueden ajustar sin tocar la lógica)
export const MODELO_EMBEDDING = 'gemini-embedding-001';
// gemini-3.5-flash solo permite 20 peticiones al día en el plan gratuito. La cuota es por modelo.
export const MODELO_CHAT = 'gemini-3.1-flash-lite';
export const MODELO_CHAT_RESPALDO = 'gemini-3.5-flash-lite'; // si el principal se satura o agota su cuota

export const NIVELES_PALABRAS_CLAVE_TAREAS = [
  'tarea',
  'tareas',
  'pendiente',
  'pendientes',
  'fecha',
  'fechas',
  'vence',
  'límite',
  'limite',
]; // RN-12
