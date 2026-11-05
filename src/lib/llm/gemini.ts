import { GoogleGenAI } from '@google/genai';
import {
  EMBEDDING_DIMENSIONES,
  MODELO_CHAT,
  MODELO_CHAT_RESPALDO,
  MODELO_EMBEDDING,
} from '@/lib/config/nova';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

export interface LLMClient {
  generarEmbedding(texto: string): Promise<number[]>;
  generarEmbeddings(textos: string[]): Promise<number[][]>;
  responder(d: { sistema: string; contexto: string; pregunta: string }): Promise<string>;
}

const TAMANO_LOTE = 50; // la API admite hasta 100 textos por petición

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

/** Saturación momentánea (503 frecuente): reintentar puede bastar. */
function esErrorTemporal(error: unknown): boolean {
  const estado = estadoDe(error);
  return estado === 500 || estado === 503;
}

/** Además de la saturación, una cuota agotada (429): no se reintenta, pero la cuota es por modelo. */
function ameritaRespaldo(error: unknown): boolean {
  return esErrorTemporal(error) || estadoDe(error) === 429;
}

async function conReintentos<T>(trabajo: () => Promise<T>): Promise<T> {
  for (const espera of ESPERAS_REINTENTO_MS) {
    try {
      return await trabajo();
    } catch (error) {
      if (!esErrorTemporal(error)) throw error;
      await new Promise((resolver) => setTimeout(resolver, espera));
    }
  }
  return trabajo();
}

async function embeber(textos: string[], tipo: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'): Promise<number[][]> {
  const ai = obtenerCliente();
  const vectores: number[][] = [];
  try {
    for (let i = 0; i < textos.length; i += TAMANO_LOTE) {
      const respuesta = await conReintentos(() =>
        ai.models.embedContent({
          model: MODELO_EMBEDDING,
          contents: textos.slice(i, i + TAMANO_LOTE),
          config: { outputDimensionality: EMBEDDING_DIMENSIONES, taskType: tipo },
        }),
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
    const [vector] = await embeber([texto], 'RETRIEVAL_QUERY');
    return vector as number[];
  },

  generarEmbeddings(textos) {
    return embeber(textos, 'RETRIEVAL_DOCUMENT');
  },

  async responder({ sistema, contexto, pregunta }) {
    const ai = obtenerCliente();
    const generar = (model: string) =>
      conReintentos(() =>
        ai.models.generateContent({
          model,
          contents: `CONTEXTO:\n${contexto || '(sin contexto)'}\n\nPREGUNTA:\n${pregunta}`,
          config: { systemInstruction: sistema, temperature: 0.2 },
        }),
      );
    try {
      const respuesta = await generar(MODELO_CHAT).catch((error: unknown) => {
        if (!ameritaRespaldo(error)) throw error;
        console.warn(`${MODELO_CHAT} no disponible; se usa ${MODELO_CHAT_RESPALDO}.`);
        return generar(MODELO_CHAT_RESPALDO);
      });
      const texto = respuesta.text?.trim();
      if (!texto) throw new Error('Respuesta vacía de Gemini');
      return texto;
    } catch (error) {
      return comoErrorLlm(error);
    }
  },
};
