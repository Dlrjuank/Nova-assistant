// E10c2: las pruebas reales no repiten embeddings ya calculados, para no gastar la cuota que usa producción.
// Solo se reutiliza un vector si coinciden el texto, el modelo y la dimensión. También el tipo (consulta o documento),
// porque Gemini da vectores distintos para cada uno. Se guarda fuera de git y solo con el hash del texto.
// Con SIN_CACHE_EMBEDDINGS=1 se ignora y todo va a Gemini.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { EMBEDDING_DIMENSIONES, MODELO_EMBEDDING } from '@/lib/config/nova';
import type { LLMClient } from '@/lib/llm/gemini';

export const RUTA_CACHE = '.cache-pruebas/embeddings.json';

type TipoEmbedding = 'consulta' | 'documento';
type Modelo = { modelo: string; dimension: number };

export function claveEmbedding(texto: string, tipo: TipoEmbedding, { modelo, dimension }: Modelo): string {
  return createHash('sha256').update(JSON.stringify([modelo, dimension, tipo, texto])).digest('hex');
}

export interface Almacen {
  leer(clave: string): number[] | undefined;
  escribir(clave: string, vector: number[]): void;
}

export interface Contador {
  reutilizados: number;
  pedidos: number;
}

/** Cambia los métodos de embeddings del cliente; el chat y los demás no se tocan. */
export function usarCacheEmbeddings(
  cliente: Pick<LLMClient, 'generarEmbedding' | 'generarEmbeddings'>,
  almacen: Almacen,
  modelo: Modelo = { modelo: MODELO_EMBEDDING, dimension: EMBEDDING_DIMENSIONES },
): Contador {
  const contador: Contador = { reutilizados: 0, pedidos: 0 };
  const generarEmbedding = cliente.generarEmbedding.bind(cliente);
  const generarEmbeddings = cliente.generarEmbeddings.bind(cliente);
  // Un vector de otra longitud no sirve aunque la clave coincida.
  const guardado = (clave: string) => {
    const vector = almacen.leer(clave);
    return vector?.length === modelo.dimension ? vector : undefined;
  };

  cliente.generarEmbedding = async (texto) => {
    const clave = claveEmbedding(texto, 'consulta', modelo);
    const previo = guardado(clave);
    if (previo) {
      contador.reutilizados++;
      return previo;
    }
    const vector = await generarEmbedding(texto);
    contador.pedidos++;
    almacen.escribir(clave, vector);
    return vector;
  };

  cliente.generarEmbeddings = async (textos, opciones) => {
    const claves = textos.map((t) => claveEmbedding(t, 'documento', modelo));
    const vectores = claves.map(guardado);
    const faltan = textos.flatMap((_, i) => (vectores[i] ? [] : [i]));
    contador.reutilizados += textos.length - faltan.length;
    if (faltan.length > 0) {
      const nuevos = await generarEmbeddings(faltan.map((i) => textos[i] as string), opciones);
      contador.pedidos += faltan.length;
      faltan.forEach((i, n) => {
        vectores[i] = nuevos[n] as number[];
        almacen.escribir(claves[i] as string, nuevos[n] as number[]);
      });
    }
    return vectores as number[][];
  };

  return contador;
}

function almacenEnArchivo(ruta: string): Almacen {
  const datos: Record<string, number[]> = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : {};
  return {
    leer: (clave) => datos[clave],
    escribir(clave, vector) {
      datos[clave] = vector;
      mkdirSync(dirname(ruta), { recursive: true });
      writeFileSync(ruta, JSON.stringify(datos), 'utf8');
    },
  };
}

/** Para los scripts de prueba. Devuelve la línea que se imprime al terminar. */
export function instalarCacheEmbeddings(cliente: Pick<LLMClient, 'generarEmbedding' | 'generarEmbeddings'>): () => string {
  if (process.env.SIN_CACHE_EMBEDDINGS === '1') return () => 'Embeddings: sin caché, todos a Gemini';
  const contador = usarCacheEmbeddings(cliente, almacenEnArchivo(RUTA_CACHE));
  return () => `Embeddings: ${contador.reutilizados} reutilizados, ${contador.pedidos} pedidos a Gemini`;
}
