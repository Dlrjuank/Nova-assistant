import { GoogleGenAI } from '@google/genai';
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
  generarEmbeddings(textos: string[], opciones?: { interactivo?: boolean }): Promise<number[][]>;
  responder(d: {
    sistema: string;
    contexto: string;
    pregunta: string;
    historial?: TurnoConversacion[] | undefined;
  }): Promise<string>;
}

// El plan gratuito admite 30.000 tokens de embeddings por minuto y 500 palabras pueden pasar de 800 tokens:
// un lote de 50 fragmentos densos superaría el límite por sí solo y nunca pasaría.
const TAMANO_LOTE = 20;
const MENSAJE_CUOTA =
  'Se alcanzó el límite de uso del asistente. Si el documento es muy largo, intente con uno más corto.';
// Cuánto se puede esperar la cuota por minuto. Deben caber en el maxDuration de sus rutas (300 s y 60 s).
const ESPERA_MAXIMA_INDEXAR_MS = 270_000;
const ESPERA_MAXIMA_CONSULTAR_MS = 25_000;
// La ruta del Asistente tiene 60 s. Sin estos topes, una llamada que no contesta consume todo ese tiempo.
const TIEMPO_INTENTO_EMBEDDING_MS = 10_000;
const TIEMPO_MODELO_PRINCIPAL_MS = 15_000;
const TIEMPO_RESPONDER_MS = 40_000;

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

const ESPERAS_REINTENTO_MS = [500, 1500]; // cortas: las rutas tienen un tiempo máximo de ejecución

function estadoDe(error: unknown): number | undefined {
  return ((error ?? {}) as { status?: number }).status;
}

/** Saturación momentánea (503 frecuente), conexión cortada o sin respuesta a tiempo: reintentar puede bastar. */
function esErrorTemporal(error: unknown): boolean {
  const estado = estadoDe(error);
  return estado === 500 || estado === 503 || (error as Error)?.name === 'AbortError' || (error instanceof TypeError && error.message === 'fetch failed');
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
    return opciones?.interactivo
      ? embeber(textos, 'RETRIEVAL_DOCUMENT', ESPERA_MAXIMA_CONSULTAR_MS, TIEMPO_INTENTO_EMBEDDING_MS)
      : embeber(textos, 'RETRIEVAL_DOCUMENT', ESPERA_MAXIMA_INDEXAR_MS);
  },

  async responder({ sistema, contexto, pregunta, historial = [] }) {
    const ai = obtenerCliente();
    // RN-21: los mensajes previos van como turnos; el contexto recuperado acompaña solo a la pregunta nueva.
    const contents = [
      ...historial.map((m) => ({ role: m.autor === 'usuario' ? 'user' : 'model', parts: [{ text: m.texto }] })),
      { role: 'user', parts: [{ text: `CONTEXTO:\n${contexto || '(sin contexto)'}\n\nPREGUNTA:\n${pregunta}` }] },
    ];
    const limite = Date.now() + TIEMPO_RESPONDER_MS;
    const generar = (model: string, tiempoMs: number) =>
      ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction: sistema, temperature: 0.2, httpOptions: { timeout: tiempoMs } },
      });
    try {
      // Un modelo saturado no se recupera en segundos: se pasa al respaldo sin reintentar, y se gastan menos llamadas.
      const respuesta = await generar(MODELO_CHAT, TIEMPO_MODELO_PRINCIPAL_MS).catch((error: unknown) => {
        if (!ameritaRespaldo(error)) throw error;
        console.warn(`${MODELO_CHAT} no disponible (${estadoDe(error) ?? (error as Error)?.name}); se usa ${MODELO_CHAT_RESPALDO}.`);
        return conReintentos(() => generar(MODELO_CHAT_RESPALDO, Math.max(limite - Date.now(), 1)), limite);
      });
      const texto = respuesta.text?.trim();
      if (!texto) throw new Error('Respuesta vacía de Gemini');
      return texto;
    } catch (error) {
      return comoErrorLlm(error);
    }
  },
};
