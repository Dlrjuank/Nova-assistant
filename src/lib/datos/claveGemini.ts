import { MODELO_CHAT } from '@/lib/config/nova';
import { consultar } from '@/lib/db/conexion';
import { cifrarClave, descifrarClave, LlaveNoDisponible } from '@/lib/ia/cifrado';
import { errorSinClave } from '@/lib/ia/ocultarClave';
import { alTerminarIa } from '@/lib/llm/contextoIa';
import { hoyBogota } from '@/lib/reglas/fechas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import {
  formatoDeClave,
  TEXTO_CLAVE_GUARDADA,
  TEXTO_CLAVE_NO_ACEPTADA,
  TEXTO_CLAVE_SIN_CUOTA,
  type EstadoClave,
  type EstadoIa,
  type InfoClave,
} from '@/lib/reglas/claveGemini';
import { esCorreoDueno } from '@/modules/auth/admin';

/**
 * E20c-1 (PLAN_AMPLIACION 5.14, 7.15; RB-76 a RB-80, RB-90): la clave de Gemini de cada persona. Es el único lugar
 * que la descifra; `src/lib/llm/gemini.ts` la pide con `resolverClave` dentro de `conIaDe`. Ninguna función de aquí
 * devuelve la clave a una ruta: solo sus últimos 4 caracteres.
 */

interface FilaClave {
  cifrada: Buffer;
  iv: Buffer;
  etiqueta: Buffer;
  version_llave: number;
  ultimos4: string;
  estado: EstadoClave;
  verificada_en: string;
}

interface Resuelta {
  apiKey: string;
  origen: 'propia' | 'proyecto';
  estado: EstadoClave | null;
  hasta: number;
}

// 7.15: la clave descifrada vive en la memoria de la instancia como mucho 5 minutos; cambiarla o desvincularla la borra.
const MEMORIA_MS = 5 * 60_000;
const memoria = new Map<string, Resuelta>();
const TIEMPO_VERIFICAR_MS = 10_000;

export function olvidarClaveEnMemoria(usuarioId: string): void {
  memoria.delete(usuarioId);
}

async function filaDe(usuarioId: string): Promise<FilaClave | undefined> {
  const [fila] = await consultar<FilaClave>(
    `SELECT cifrada, iv, etiqueta, version_llave, ultimos4, estado, to_char(verificada_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS verificada_en
     FROM claves_gemini WHERE usuario_id = $1`,
    [usuarioId],
  );
  return fila;
}

/**
 * RB-76 (cambios del 2026-11-25): la clave del proyecto solo la usa el dueño sin clave propia y, desde E20c-2 (M25),
 * quien tenga el permiso `usa_clave_proyecto`. Un administrador no la usa por serlo.
 */
export async function puedeUsarClaveProyecto(usuarioId: string): Promise<boolean> {
  const [cuenta] = await consultar<{ email: string | null }>('SELECT email FROM auth.users WHERE id = $1', [usuarioId]);
  return esCorreoDueno(cuenta?.email);
}

/** La clave con la que esa persona llama a Gemini, o el error de RB-78, RB-79 o RB-90 (nunca la del proyecto en su lugar). */
export async function resolverClave(usuarioId: string): Promise<{ apiKey: string; origen: 'propia' | 'proyecto'; estado: EstadoClave | null }> {
  const guardada = memoria.get(usuarioId);
  if (guardada && guardada.hasta > Date.now()) return guardada;
  const fila = await filaDe(usuarioId);
  let resuelta: Omit<Resuelta, 'hasta'>;
  if (fila) {
    if (fila.estado === 'rechazada') throw new ErrorDeNegocio('CLAVE_GEMINI_RECHAZADA');
    if (fila.estado === 'ilegible') throw new ErrorDeNegocio('CLAVE_GEMINI_ILEGIBLE');
    let apiKey: string;
    try {
      apiKey = descifrarClave({ cifrada: fila.cifrada, iv: fila.iv, etiqueta: fila.etiqueta, version: fila.version_llave }, usuarioId);
    } catch (error) {
      if (error instanceof LlaveNoDisponible) {
        // Falta configurar una llave: es un error de Nova, no de la persona. No se marca la clave (vuelve a servir al configurarla).
        console.error(`Clave de Gemini sin llave para descifrarla: ${error.message}`);
      } else {
        await marcarEstadoClave(usuarioId, 'ilegible');
      }
      throw new ErrorDeNegocio('CLAVE_GEMINI_ILEGIBLE');
    }
    resuelta = { apiKey, origen: 'propia', estado: fila.estado };
  } else {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!(await puedeUsarClaveProyecto(usuarioId))) throw new ErrorDeNegocio('SIN_CLAVE_GEMINI');
    if (!apiKey) {
      console.error('Falta la variable de entorno GEMINI_API_KEY.');
      throw new ErrorDeNegocio('ERROR_LLM');
    }
    resuelta = { apiKey, origen: 'proyecto', estado: null };
  }
  memoria.set(usuarioId, { ...resuelta, hasta: Date.now() + MEMORIA_MS });
  return resuelta;
}

/** 7.15: al usarla, 401/403 la deja `rechazada`, 429 `sin_cuota` y la siguiente llamada que funcione, `activa`. */
export async function marcarEstadoClave(usuarioId: string, estado: EstadoClave): Promise<void> {
  if (estado === 'rechazada' || estado === 'ilegible') memoria.delete(usuarioId);
  else {
    const guardada = memoria.get(usuarioId);
    if (guardada?.origen === 'propia') guardada.estado = estado;
  }
  await consultar('UPDATE claves_gemini SET estado = $2, actualizada_en = now() WHERE usuario_id = $1 AND estado <> $2', [usuarioId, estado]);
}

/**
 * 7.15: una llamada que no gasta cuota de generación, pedir los datos del modelo de chat. La clave va en el
 * encabezado (no en la dirección, que podría quedar en un registro).
 */
export async function verificarConGoogle(clave: string): Promise<'activa' | 'sin_cuota' | 'rechazada' | 'sin_respuesta'> {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_CHAT}`, {
      headers: { 'x-goog-api-key': clave },
      signal: AbortSignal.timeout(TIEMPO_VERIFICAR_MS),
      cache: 'no-store',
    });
    if (r.ok) return 'activa';
    if (r.status === 429) return 'sin_cuota';
    if (r.status === 400 || r.status === 401 || r.status === 403) return 'rechazada';
    console.error(`Google respondió ${r.status} al verificar una clave de Gemini.`);
    return 'sin_respuesta';
  } catch (error) {
    console.error('No se pudo verificar una clave de Gemini con Google:', errorSinClave(error, clave));
    return 'sin_respuesta';
  }
}

/** RB-77: verificar y guardar (o cambiar). Si Google no la acepta, no se guarda nada y la anterior sigue igual. */
export async function guardarClaveGemini(usuarioId: string, texto: unknown): Promise<InfoClave & { mensaje: string }> {
  const clave = typeof texto === 'string' ? formatoDeClave(texto) : null;
  if (!clave) throw new ErrorDeNegocio('CLAVE_GEMINI_INVALIDA');
  const resultado = await verificarConGoogle(clave);
  if (resultado === 'rechazada') throw new ErrorDeNegocio('CLAVE_GEMINI_INVALIDA', TEXTO_CLAVE_NO_ACEPTADA);
  if (resultado === 'sin_respuesta') throw new ErrorDeNegocio('CLAVE_GEMINI_NO_VERIFICADA');
  const c = cifrarClave(clave, usuarioId);
  const ultimos4 = clave.slice(-4);
  const [fila] = await consultar<{ verificada_en: string }>(
    `INSERT INTO claves_gemini (usuario_id, cifrada, iv, etiqueta, version_llave, ultimos4, estado, verificada_en, actualizada_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
     ON CONFLICT (usuario_id) DO UPDATE SET cifrada = EXCLUDED.cifrada, iv = EXCLUDED.iv, etiqueta = EXCLUDED.etiqueta,
       version_llave = EXCLUDED.version_llave, ultimos4 = EXCLUDED.ultimos4, estado = EXCLUDED.estado,
       verificada_en = now(), actualizada_en = now()
     RETURNING to_char(verificada_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS verificada_en`,
    [usuarioId, c.cifrada, c.iv, c.etiqueta, c.version, ultimos4, resultado],
  );
  memoria.delete(usuarioId);
  return {
    vinculada: true,
    ultimos4,
    estado: resultado,
    verificadaEn: fila?.verificada_en ?? null,
    mensaje: resultado === 'sin_cuota' ? TEXTO_CLAVE_SIN_CUOTA : TEXTO_CLAVE_GUARDADA,
  };
}

/** RB-80: borra la clave de la base y de la memoria. */
export async function desvincularClaveGemini(usuarioId: string): Promise<void> {
  await consultar('DELETE FROM claves_gemini WHERE usuario_id = $1', [usuarioId]);
  memoria.delete(usuarioId);
}

/** Lo que ve la pantalla: nunca la clave, solo sus últimos 4. */
export async function infoClaveGemini(usuarioId: string): Promise<InfoClave> {
  const [fila] = await consultar<{ ultimos4: string; estado: EstadoClave; verificada_en: string }>(
    `SELECT ultimos4, estado, to_char(verificada_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS verificada_en
     FROM claves_gemini WHERE usuario_id = $1`,
    [usuarioId],
  );
  if (!fila) return { vinculada: false, ultimos4: null, estado: null, verificadaEn: null };
  return { vinculada: true, ultimos4: fila.ultimos4, estado: fila.estado, verificadaEn: fila.verificada_en };
}

/** Qué IA tiene la persona ahora, sin descifrar nada (para el aviso de RB-79 en las pantallas). */
export async function estadoIa(usuarioId: string): Promise<EstadoIa> {
  const info = await infoClaveGemini(usuarioId);
  if (info.estado === 'activa') return 'propia';
  if (info.estado) return info.estado;
  return (await puedeUsarClaveProyecto(usuarioId)) ? 'proyecto' : 'sin_clave';
}

/** M24: solo el conteo de llamadas a Gemini por cuenta y día de Bogotá. */
export async function registrarUsoIa(usuarioId: string, llamadas: number): Promise<void> {
  await consultar(
    `INSERT INTO uso_ia_diario (usuario_id, dia, consultas) VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id, dia) DO UPDATE SET consultas = uso_ia_diario.consultas + EXCLUDED.consultas`,
    [usuarioId, hoyBogota(), llamadas],
  );
}

alTerminarIa(registrarUsoIa);
