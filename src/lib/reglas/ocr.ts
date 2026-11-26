import type { EntradaIndice } from './libros';

/**
 * E20d-3 y E20d-4 (PROMPTS_AMPLIACION, E20d, opción A): leer con OCR las páginas sin texto de un PDF escaneado y las
 * fotos, con Gemini y la clave de cada persona, preguntando antes de gastar consultas. Funciones puras.
 */

/** Una página con menos texto que esto es "de imagen". */
export const CARACTERES_PAGINA_CON_TEXTO = 20;
/** Páginas por llamada a Gemini (10 a 15 en el plan). */
export const OCR_PAGINAS_POR_LLAMADA = 10;
/** Tope de páginas escaneadas por documento. */
export const OCR_MAX_PAGINAS = 300;
/** Tope de fotos por documento (E20d-4). */
export const OCR_MAX_FOTOS = 30;
/** Bytes por llamada: Gemini admite unos 20 MB por pedido y el archivo va en base64 (un tercio más). */
export const OCR_MAX_BYTES_POR_LLAMADA = 12 * 1024 * 1024;
/** Si nadie responde la pregunta en este tiempo, se toma como "Ahora no". */
export const HORAS_PREGUNTA_OCR = 24;
/** Una lectura que no avanza en este tiempo (por ejemplo, sin una clave que sirva) termina con lo leído. */
export const DIAS_LECTURA_SIN_AVANCE = 7;
/** Fallos seguidos de un grupo (que no sean de cuota) antes de terminar con lo leído. */
export const OCR_MAX_FALLOS = 5;
/** Tras un fallo en segundo plano, el documento espera esto antes de volver a intentarse (y deja pasar a los demás). */
export const MINUTOS_ESPERA_TRAS_FALLO = 10;
/** Lo que tarda una llamada, para estimar (de 10 a 30 s). */
const SEGUNDOS_POR_LLAMADA = 20;

export const MARCA_ILEGIBLE = '[ilegible]';

/** Lo que espera la lectura con OCR, guardado en `documentos.por_indexar` (un objeto; lo normal es una lista). */
export interface LecturaOcr {
  ocr: true;
  /** `pregunta`: espera "Leerlas" o "Ahora no"; `leyendo`: se lee por grupos. */
  estado: 'pregunta' | 'leyendo';
  fuente: 'pdf' | 'fotos';
  /** El PDF (uno) o las fotos (una por página), en Blob mientras se leen. */
  urls: string[];
  /** El texto de cada página; las que faltan, vacías. */
  textos: string[];
  /** Páginas (desde 1) que faltan por leer con OCR, en orden. */
  porLeer: number[];
  /** Páginas ya leídas con OCR. */
  leidas: number[];
  /** Las que había que leer al empezar (para el avance). */
  total: number;
  etiquetas: string[] | null;
  indice: EntradaIndice[];
  /** Hasta cuándo se espera la respuesta (ISO). */
  venceEn: string;
  /** Cuándo avanzó por última vez (ISO): al responder "Leerlas" y en cada grupo. */
  avanzoEn?: string;
  /** Fallos seguidos que no son de cuota. */
  fallos?: number;
}

export function esLecturaOcr(valor: unknown): valor is LecturaOcr {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) && (valor as { ocr?: unknown }).ocr === true;
}

/** Las páginas (desde 1) que no tienen texto. */
export function paginasSinTexto(paginas: readonly string[]): number[] {
  return paginas.flatMap((t, i) => (t.replace(/\s+/g, '').length < CARACTERES_PAGINA_CON_TEXTO ? [i + 1] : []));
}

/** Cuántas consultas y cuántos minutos, más o menos. */
export function estimarOcr(paginas: number): { consultas: number; minutos: number } {
  const consultas = Math.max(1, Math.ceil(paginas / OCR_PAGINAS_POR_LLAMADA));
  return { consultas, minutos: Math.max(1, Math.round((consultas * SEGUNDOS_POR_LLAMADA) / 60)) };
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** "Este PDF tiene 180 páginas escaneadas. Leerlas usa unas 18 consultas de tu clave de Gemini (unos 6 minutos). ¿Leerlas?" */
export function textoPreguntaOcr(paginas: number, fuente: LecturaOcr['fuente']): string {
  const { consultas, minutos } = estimarOcr(paginas);
  const que =
    fuente === 'fotos'
      ? `${paginas === 1 ? 'Esta foto se lee' : `Estas ${paginas} fotos se leen`} con OCR.`
      : `Este PDF tiene ${plural(paginas, 'página escaneada', 'páginas escaneadas')}.`;
  const cuanto = consultas === 1 ? 'una consulta' : `unas ${consultas} consultas`;
  const tiempo = minutos === 1 ? 'cerca de un minuto' : `unos ${minutos} minutos`;
  return `${que} ${paginas === 1 ? 'Leerla' : 'Leerlas'} usa ${cuanto} de tu clave de Gemini (${tiempo}). ¿${paginas === 1 ? 'Leerla' : 'Leerlas'}?`;
}

/** El grupo siguiente: hasta OCR_PAGINAS_POR_LLAMADA páginas y, si se conocen sus tamaños, sin pasar del tope de bytes. */
export function siguienteGrupo(porLeer: readonly number[], tamano?: (pagina: number) => number): number[] {
  const grupo: number[] = [];
  let bytes = 0;
  for (const p of porLeer) {
    const t = tamano?.(p) ?? 0;
    if (grupo.length > 0 && (grupo.length >= OCR_PAGINAS_POR_LLAMADA || bytes + t > OCR_MAX_BYTES_POR_LLAMADA)) break;
    grupo.push(p);
    bytes += t;
  }
  return grupo;
}

/** Instrucciones de transcripción literal. */
export const SISTEMA_OCR = `Transcribes documentos escaneados y fotos de apuntes. Copia el texto de cada página exactamente como aparece, sin resumir, traducir, corregir ni agregar nada. Conserva los párrafos y el orden de lectura (en columnas, de arriba abajo y de izquierda a derecha). Las tablas, una fila por línea con las celdas separadas por " | ". Las fórmulas, en texto plano. Marca ${MARCA_ILEGIBLE} lo que no se pueda leer. Una página sin texto va vacía.`;

/** El pedido para un grupo de páginas. */
export function pedidoOcr(cuantas: number, fuente: LecturaOcr['fuente']): string {
  return fuente === 'fotos'
    ? `Transcribe ${plural(cuantas, 'foto', 'fotos')}, en el orden en que vienen. Devuelve una entrada por foto, con "pagina" del 1 al ${cuantas}.`
    : `Este PDF tiene ${plural(cuantas, 'página', 'páginas')}. Transcribe cada una. Devuelve una entrada por página, con "pagina" del 1 al ${cuantas}.`;
}

/** De la respuesta del modelo, el texto de cada página del grupo, en orden; la que falte queda vacía. */
export function textosDeRespuesta(respuesta: unknown, cuantas: number): string[] {
  const lista = (respuesta as { paginas?: unknown })?.paginas;
  const textos = Array.from({ length: cuantas }, () => '');
  if (!Array.isArray(lista)) return textos;
  lista.forEach((e, i) => {
    const pagina = Number((e as { pagina?: unknown })?.pagina);
    const texto = (e as { texto?: unknown })?.texto;
    if (typeof texto !== 'string') return;
    const n = Number.isInteger(pagina) && pagina >= 1 && pagina <= cuantas ? pagina : i + 1;
    if (n <= cuantas) textos[n - 1] = texto.replaceAll('\u0000', ' ').trim();
  });
  return textos;
}

/** Al terminar o al responder "Ahora no": sin texto en ninguna página, no hay nada que guardar. */
export function hayTexto(textos: readonly string[]): boolean {
  return textos.some((t) => t.trim() !== '');
}
