import { GoogleGenAI, type Schema } from '@google/genai';
import {
  EMBEDDING_DIMENSIONES,
  MODELO_CHAT,
  MODELO_CHAT_RESPALDO,
  MODELO_EMBEDDING,
} from '@/lib/config/nova';
import type { TurnoConversacion } from '@/lib/llm/prompts';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

export interface LLMClient {
  generarEmbedding(texto: string): Promise<number[]>;
  /** `interactivo`: desde una ruta de 60 s; espera la cuota por minuto como una consulta, no como una indexación. */
  /** `sinEsperarCuota` (RB-57): si Gemini pide esperar, falla enseguida; el aviso de cada minuto lo reintenta. */
  generarEmbeddings(textos: string[], opciones?: { interactivo?: boolean; sinEsperarCuota?: boolean }): Promise<number[][]>;
  responder(d: {
    sistema: string;
    contexto: string;
    pregunta: string;
    historial?: TurnoConversacion[] | undefined;
  }): Promise<string>;
  /**
   * E10e (9.6): una respuesta en JSON con esquema, con el mismo respaldo y los mismos topes que `responder`.
   * `tiempoMaximoMs` acorta el presupuesto para que quepa en la ruta. Sin cupo en ninguno de los dos modelos,
   * CUOTA_AGOTADA (RB-52). El llamador valida el contenido: aquí solo se comprueba que sea JSON.
   */
  generarJson(d: { sistema: string; contenido: string; esquema: Schema; tiempoMaximoMs?: number | undefined }): Promise<unknown>;
}

// El plan gratuito admite 30.000 tokens de embeddings por minuto y 500 palabras pueden pasar de 800 tokens:
// un lote de 50 fragmentos densos superaría el límite por sí solo y nunca pasaría.
const TAMANO_LOTE = 20;
const MENSAJE_CUOTA =
  'Se alcanzó el límite de uso del asistente. Si el documento es muy largo, intenta con uno más corto.';
// Cuánto se puede esperar la cuota por minuto. Deben caber en el maxDuration de sus rutas (300 s y 60 s).
const ESPERA_MAXIMA_INDEXAR_MS = 270_000;
const ESPERA_MAXIMA_CONSULTAR_MS = 25_000;
// La ruta del Asistente tiene 60 s. Sin estos topes, una llamada que no contesta consume todo ese tiempo.
const TIEMPO_INTENTO_EMBEDDING_MS = 10_000;
// RB-57: el aviso de cada minuto tiene 60 s; un lote de 20 fragmentos cabe de sobra.
const TIEMPO_INTENTO_INDEXAR_SOLO_MS = 30_000;
const TIEMPO_MODELO_PRINCIPAL_MS = 15_000;
const TIEMPO_RESPONDER_MS = 40_000;
// Con un contexto así de largo (un capítulo, "Explicar de otra manera"), tardar no indica saturación: resumir
// un capítulo llevó 40 s. Siempre empieza el principal, con más tiempo; caben en los 120 s de /api/nova/consultar.
const CONTEXTO_LARGO_CARACTERES = 30_000;
const TIEMPO_PRINCIPAL_LARGO_MS = 75_000;
const TIEMPO_RESPONDER_LARGO_MS = 110_000;
const MEMORIA_SATURACION_MS = 5 * 60_000;

// Vive en la memoria de cada instancia de Vercel: no se comparte entre instancias y se pierde al apagarse.
let principalSaturadoHasta = 0;

let cliente: GoogleGenAI | undefined;
function obtenerCliente(): GoogleGenAI {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) {
    console.error('Falta la variable de entorno GEMINI_API_KEY.');
    throw new ErrorDeNegocio('ERROR_LLM');
  }
  cliente ??= new GoogleGenAI({ apiKey: clave });
  return cliente;
}

/** Registra el fallo del proveedor y lo expone como ERROR_LLM sin detalles técnicos. */
function comoErrorLlm(error: unknown): never {
  if (error instanceof ErrorDeNegocio) throw error;
  console.error('Fallo al llamar a Gemini:', error);
  throw new ErrorDeNegocio('ERROR_LLM');
}

/** Solo un 503 o un modelo que no contesta. Una cuota agotada o un error interno no recuerdan nada. */
function indicaSaturacion(error: unknown, caracteres: number): boolean {
  return estadoDe(error) === 503 || (noContesto(error) && caracteres < CONTEXTO_LARGO_CARACTERES);
}

const ESPERAS_REINTENTO_MS = [500, 1500]; // cortas: las rutas tienen un tiempo máximo de ejecución

function estadoDe(error: unknown): number | undefined {
  return ((error ?? {}) as { status?: number }).status;
}

/** El SDK le avisa el tope a Gemini: a veces corta él mismo (AbortError) y a veces responde 504 poco antes. */
function noContesto(error: unknown): boolean {
  return estadoDe(error) === 504 || (error as Error)?.name === 'AbortError';
}

/** Saturación momentánea (503 frecuente), conexión cortada o sin respuesta a tiempo: reintentar puede bastar. */
function esErrorTemporal(error: unknown): boolean {
  const estado = estadoDe(error);
  return estado === 500 || estado === 503 || noContesto(error) || (error instanceof TypeError && error.message === 'fetch failed');
}

/** Además de la saturación, una cuota agotada (429): no se reintenta, pero la cuota es por modelo. */
function ameritaRespaldo(error: unknown): boolean {
  return esErrorTemporal(error) || estadoDe(error) === 429;
}

async function conReintentos<T>(trabajo: () => Promise<T>, limite = Infinity): Promise<T> {
  for (const espera of ESPERAS_REINTENTO_MS) {
    try {
      return await trabajo();
    } catch (error) {
      if (!esErrorTemporal(error) || Date.now() + espera >= limite) throw error;
      await new Promise((resolver) => setTimeout(resolver, espera));
    }
  }
  return trabajo();
}

/** Gemini indica en el error cuánto esperar, por ejemplo "retryDelay":"16s". */
function milisegundosDeEspera(error: unknown): number {
  const segundos = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(String((error as Error)?.message))?.[1];
  return segundos === undefined ? 60_000 : Number(segundos) * 1000;
}

/** Ante un 429 espera lo que indique Gemini si cabe antes del límite; una cuota diaria no cabe y falla enseguida. */
async function conEsperaDeCuota<T>(trabajo: () => Promise<T>, limite: number): Promise<T> {
  for (;;) {
    try {
      return await conReintentos(trabajo, limite);
    } catch (error) {
      if (estadoDe(error) !== 429) throw error;
      const espera = milisegundosDeEspera(error);
      if (Date.now() + espera > limite) {
        console.error('Cuota de Gemini agotada y sin tiempo para esperar:', error);
        throw new ErrorDeNegocio('ERROR_LLM', MENSAJE_CUOTA);
      }
      await new Promise((resolver) => setTimeout(resolver, espera));
    }
  }
}

async function embeber(
  textos: string[],
  tipo: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT',
  esperaMaximaMs: number,
  tiempoIntentoMs?: number,
): Promise<number[][]> {
  const ai = obtenerCliente();
  const vectores: number[][] = [];
  const limite = Date.now() + esperaMaximaMs;
  try {
    for (let i = 0; i < textos.length; i += TAMANO_LOTE) {
      const respuesta = await conEsperaDeCuota(
        () =>
          ai.models.embedContent({
            model: MODELO_EMBEDDING,
            contents: textos.slice(i, i + TAMANO_LOTE),
            config: { outputDimensionality: EMBEDDING_DIMENSIONES, taskType: tipo, ...(tiempoIntentoMs ? { httpOptions: { timeout: tiempoIntentoMs } } : {}) },
          }),
        limite,
      );
      for (const e of respuesta.embeddings ?? []) {
        if (e.values?.length !== EMBEDDING_DIMENSIONES) {
          throw new Error(`Embedding de ${e.values?.length} dimensiones; se esperaban ${EMBEDDING_DIMENSIONES}`);
        }
        vectores.push(e.values);
      }
    }
    if (vectores.length !== textos.length) {
      throw new Error(`Se recibieron ${vectores.length} embeddings para ${textos.length} textos`);
    }
    return vectores;
  } catch (error) {
    return comoErrorLlm(error);
  }
}

export const llm: LLMClient = {
  async generarEmbedding(texto) {
    const [vector] = await embeber([texto], 'RETRIEVAL_QUERY', ESPERA_MAXIMA_CONSULTAR_MS, TIEMPO_INTENTO_EMBEDDING_MS);
    return vector as number[];
  },

  generarEmbeddings(textos, opciones) {
    if (opciones?.sinEsperarCuota) return embeber(textos, 'RETRIEVAL_DOCUMENT', 0, TIEMPO_INTENTO_INDEXAR_SOLO_MS);
    return opciones?.interactivo
      ? embeber(textos, 'RETRIEVAL_DOCUMENT', ESPERA_MAXIMA_CONSULTAR_MS, TIEMPO_INTENTO_EMBEDDING_MS)
      : embeber(textos, 'RETRIEVAL_DOCUMENT', ESPERA_MAXIMA_INDEXAR_MS);
  },

  async responder({ sistema, contexto, pregunta, historial = [] }) {
    // RN-21: los mensajes previos van como turnos; el contexto recuperado acompaña solo a la pregunta nueva.
    const contents = [
      ...historial.map((m) => ({ role: m.autor === 'usuario' ? 'user' : 'model', parts: [{ text: m.texto }] })),
      // E10c3: la IA general no lleva contexto, así que va solo la pregunta.
      { role: 'user', parts: [{ text: contexto ? `CONTEXTO:\n${contexto}\n\nPREGUNTA:\n${pregunta}` : pregunta }] },
    ];
    try {
      return await conRespaldo(contents, { systemInstruction: sistema, temperature: 0.2 }, contexto.length);
    } catch (error) {
      return comoErrorLlm(error);
    }
  },

  async generarJson({ sistema, contenido, esquema, tiempoMaximoMs }) {
    const config = { systemInstruction: sistema, temperature: 0.4, responseMimeType: 'application/json', responseSchema: esquema };
    let texto: string;
    try {
      texto = await conRespaldo([{ role: 'user', parts: [{ text: contenido }] }], config, contenido.length, tiempoMaximoMs);
    } catch (error) {
      if (estadoDe(error) === 429) {
        console.error('Cuota de Gemini agotada en los dos modelos:', error);
        throw new ErrorDeNegocio('CUOTA_AGOTADA');
      }
      return comoErrorLlm(error);
    }
    try {
      return JSON.parse(texto) as unknown;
    } catch {
      console.error('Gemini no devolvió JSON válido.');
      throw new ErrorDeNegocio('ERROR_LLM');
    }
  },
};

type Turno = { role: string; parts: Array<{ text: string }> };

/**
 * El modelo principal con un intento y un tope; si está saturado, no contesta o no tiene cupo, el respaldo con el
 * tiempo que quede. Con el principal saturado hace poco, se empieza por el respaldo, y si este falla vuelve el
 * principal. Un texto largo ignora esa memoria: el respaldo solo entra si el principal falla o se le acaba el tiempo.
 * Devuelve el texto o lanza el error del último modelo.
 */
async function conRespaldo(contents: Turno[], config: Record<string, unknown>, caracteres: number, tiempoMaximoMs = Infinity): Promise<string> {
  const ai = obtenerCliente();
  const largo = caracteres >= CONTEXTO_LARGO_CARACTERES;
  const limite = Date.now() + Math.min(largo ? TIEMPO_RESPONDER_LARGO_MS : TIEMPO_RESPONDER_MS, tiempoMaximoMs);
  const generar = async (model: string, tiempoMs: number) => {
    const respuesta = await ai.models.generateContent({ model, contents, config: { ...config, httpOptions: { timeout: tiempoMs } } });
    const texto = respuesta.text?.trim();
    if (!texto) throw new Error('Respuesta vacía de Gemini');
    return texto;
  };
  const primero = !largo && Date.now() < principalSaturadoHasta ? MODELO_CHAT_RESPALDO : MODELO_CHAT;
  const segundo = primero === MODELO_CHAT ? MODELO_CHAT_RESPALDO : MODELO_CHAT;
  const tiempoPrimero = Math.max(Math.min(largo ? TIEMPO_PRINCIPAL_LARGO_MS : TIEMPO_MODELO_PRINCIPAL_MS, limite - Date.now()), 1);
  try {
    // Un modelo saturado no se recupera en segundos: se pasa al otro sin reintentar, y se gastan menos llamadas.
    return await generar(primero, tiempoPrimero).catch((error: unknown) => {
      if (primero === MODELO_CHAT) {
        if (!ameritaRespaldo(error)) throw error;
        if (indicaSaturacion(error, caracteres)) principalSaturadoHasta = Date.now() + MEMORIA_SATURACION_MS;
      } else {
        principalSaturadoHasta = 0;
      }
      if (Date.now() >= limite) throw error;
      console.warn(`${primero} no disponible (${estadoDe(error) ?? (error as Error)?.name}); se usa ${segundo}.`);
      return conReintentos(() => generar(segundo, Math.max(limite - Date.now(), 1)), limite);
    });
  } catch (error) {
    principalSaturadoHasta = 0; // ninguno respondió: la próxima pregunta vuelve a probar el principal
    throw error;
  }
}
