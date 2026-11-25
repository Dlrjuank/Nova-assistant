/**
 * E20c-1 (PLAN_AMPLIACION 5.14, 7.15; RB-76 a RB-80 y RB-90): textos y reglas de la clave de Gemini propia,
 * compartidos por el servidor y la pantalla. La clave nunca llega a la pantalla: solo sus últimos 4 caracteres.
 */
export type EstadoClave = 'activa' | 'rechazada' | 'sin_cuota' | 'ilegible';

/** Qué IA tiene una persona ahora (para mostrar el aviso de RB-79 en lugar de los botones de IA). */
export type EstadoIa = 'propia' | 'proyecto' | 'sin_clave' | 'rechazada' | 'sin_cuota' | 'ilegible';

export interface InfoClave {
  vinculada: boolean;
  ultimos4: string | null;
  estado: EstadoClave | null;
  verificadaEn: string | null;
}

export const LARGO_MINIMO_CLAVE = 30;
export const LARGO_MAXIMO_CLAVE = 200;

export const TEXTO_CLAVE_INVALIDA = 'Pega tu clave de Gemini completa.'; // RB-77
export const TEXTO_CLAVE_NO_ACEPTADA = 'Google no aceptó esta clave. Revisa que la copiaste completa o crea una nueva.'; // RB-77
export const TEXTO_CLAVE_GUARDADA = 'Clave verificada y guardada.'; // RB-77
export const TEXTO_CLAVE_SIN_CUOTA = 'Clave guardada. Por ahora no tiene cuota disponible; se podrá usar cuando Google la renueve.'; // RB-77
export const TEXTO_CLAVE_NO_VERIFICADA = 'No se pudo comprobar la clave con Google. Intenta de nuevo.'; // 7.15
export const TEXTO_SIN_CLAVE = 'Para usar la IA de Nova, vincula tu clave de Gemini.'; // RB-79
export const TEXTO_CLAVE_RECHAZADA =
  'Tu clave de Gemini ya no funciona: puede que no sea válida o que la hayas revocado. Vincula una nueva en Configuración → Asistente.'; // RB-78
export const TEXTO_CUOTA_CLAVE =
  'Tu clave de Gemini llegó a su límite de uso por ahora. Intenta más tarde o revisa tu cuota en Google AI Studio.'; // RB-78
export const TEXTO_CLAVE_ILEGIBLE = 'No pudimos leer tu clave de Gemini guardada. Vincúlala de nuevo en Configuración → Asistente.'; // RB-90
export const CONFIRMAR_DESVINCULAR = '¿Desvincular tu clave de Gemini? Nova no podrá usar la IA hasta que vincules otra.'; // RB-80
export const TEXTO_DESVINCULADA = 'Clave desvinculada.'; // RB-80
export const RUTA_GUIA_CLAVE = '/nova/configuracion/gemini';
export const TEXTO_ENLACE_GUIA = 'Cómo crear tu clave';

/** RB-77: sin espacios por dentro y de 30 a 200 caracteres (los espacios de los extremos se quitan al pegar). */
export function formatoDeClave(texto: string): string | null {
  const clave = texto.trim();
  if (clave.length < LARGO_MINIMO_CLAVE || clave.length > LARGO_MAXIMO_CLAVE || /\s/.test(clave)) return null;
  return clave;
}

/** Cómo se ve el estado de la clave vinculada en Configuración (5.14). */
export function textoEstadoClave(estado: EstadoClave): string {
  switch (estado) {
    case 'activa':
      return 'Funciona';
    case 'sin_cuota':
      return 'Sin cuota por ahora';
    case 'rechazada':
      return 'No funciona: vincula una nueva';
    case 'ilegible':
      return 'No se puede leer: vincúlala de nuevo';
  }
}

/** El aviso que reemplaza a un botón de IA, según el estado (null: la IA está disponible). */
export function avisoDeIa(estado: EstadoIa): string | null {
  switch (estado) {
    case 'propia':
    case 'proyecto':
    case 'sin_cuota': // la clave sirve; si al usarla sigue sin cuota, lo dice el error (RB-78)
      return null;
    case 'sin_clave':
      return TEXTO_SIN_CLAVE;
    case 'rechazada':
      return TEXTO_CLAVE_RECHAZADA;
    case 'ilegible':
      return TEXTO_CLAVE_ILEGIBLE;
  }
}
