import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * E20c-1 (RB-76): de quién es la IA que se está usando. Cada servicio que llama a Gemini corre dentro de
 * `conIaDe(usuarioId, …)` (lo pone `dataService` y el aviso de cada minuto con el dueño de cada libro) y
 * `src/lib/llm/gemini.ts` elige con eso la clave: la propia o, solo si esa persona puede, la del proyecto.
 * Sin este contexto, gemini.ts no llama a Gemini (falla cerrado: nunca cae en la clave del proyecto por olvido).
 * `usuarioId: null` es la clave del proyecto a propósito, solo para los scripts de prueba (`npm run probar:*`).
 */
export interface ContextoIa {
  usuarioId: string | null;
  /** Llamadas hechas a Gemini dentro de este contexto (solo el conteo, para uso_ia_diario). */
  llamadas: number;
  /** De dónde salió la clave, una vez resuelta: cambia cómo se leen los errores de Google (7.15). */
  origen?: 'propia' | 'proyecto';
  /** El estado de la clave propia al resolverla (para volver a `activa` una que estaba sin cuota). */
  estadoClave?: 'activa' | 'rechazada' | 'sin_cuota' | 'ilegible' | null;
}

const almacen = new AsyncLocalStorage<ContextoIa>();

export function contextoIa(): ContextoIa | undefined {
  return almacen.getStore();
}

type RegistrarUso = (usuarioId: string, llamadas: number) => Promise<void>;
let registrarUso: RegistrarUso | null = null;

/** El servicio de la clave registra aquí cómo guardar el conteo (así este módulo no depende de la base). */
export function alTerminarIa(registrar: RegistrarUso): void {
  registrarUso = registrar;
}

/** Corre `trabajo` con la IA de esa persona. Dentro de otro contexto de la misma persona, reusa el de afuera. */
export async function conIaDe<T>(usuarioId: string, trabajo: () => Promise<T>): Promise<T> {
  const actual = almacen.getStore();
  if (actual && actual.usuarioId === usuarioId) return trabajo();
  const contexto: ContextoIa = { usuarioId, llamadas: 0 };
  try {
    return await almacen.run(contexto, trabajo);
  } finally {
    if (contexto.llamadas > 0 && registrarUso) {
      // El conteo nunca hace fallar la respuesta.
      await registrarUso(usuarioId, contexto.llamadas).catch((error: unknown) => {
        console.error('No se pudo registrar el uso de la IA:', (error as Error)?.message);
      });
    }
  }
}

/** Solo para los scripts de prueba con Gemini real: la clave del proyecto, sin conteo por persona. */
export function conClaveDelProyecto<T>(trabajo: () => Promise<T>): Promise<T> {
  return almacen.run({ usuarioId: null, llamadas: 0, origen: 'proyecto' }, trabajo);
}

/** Envuelve un servicio cuyo primer argumento es el usuario, para que use la IA de esa persona. */
export function usaIa<A extends [string, ...unknown[]], R>(servicio: (...argumentos: A) => Promise<R>): (...argumentos: A) => Promise<R> {
  return (...argumentos: A) => conIaDe(argumentos[0], () => servicio(...argumentos));
}
