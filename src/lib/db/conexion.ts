import { Pool, types, type PoolClient } from 'pg';
import { CA_SUPABASE } from './supabaseCa';

types.setTypeParser(1082, (v) => v); // DATE → texto
types.setTypeParser(1114, (v) => v); // TIMESTAMP → texto
types.setTypeParser(1184, (v) => v); // TIMESTAMPTZ → texto
types.setTypeParser(20, (v) => parseInt(v, 10)); // BIGINT (COUNT) → number

/**
 * Se quita `sslmode` de la URL: pg lo trata como verify-full y prevalece sobre `ssl`,
 * lo que impide usar la CA de Supabase. La verificación del certificado sigue activa.
 */
function urlSinSslmode(url: string): string {
  return url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
}

const globalParaPool = globalThis as unknown as { poolNova?: Pool };

function crearPool(): Pool {
  const url = process.env.NOVAASSISTANT_POSTGRES_URL;
  if (!url) throw new Error('Falta la variable NOVAASSISTANT_POSTGRES_URL');
  return new Pool({
    connectionString: urlSinSslmode(url),
    ssl: { ca: CA_SUPABASE },
    max: 3,
    idleTimeoutMillis: 10_000,
  });
}

/** Pool perezoso: no exige la variable al importar el módulo (p. ej. durante el build). */
export function obtenerPool(): Pool {
  globalParaPool.poolNova ??= crearPool();
  return globalParaPool.poolNova;
}

export async function consultar<T>(sql: string, valores: unknown[] = []): Promise<T[]> {
  const resultado = await obtenerPool().query(sql, valores);
  return resultado.rows as T[];
}

export async function conTransaccion<T>(trabajo: (tx: PoolClient) => Promise<T>): Promise<T> {
  const tx = await obtenerPool().connect();
  try {
    await tx.query('BEGIN');
    const resultado = await trabajo(tx);
    await tx.query('COMMIT');
    return resultado;
  } catch (error) {
    await tx.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    tx.release();
  }
}

/** Un vector se pasa a SQL como texto '[0.1,0.2,...]' y se castea con $1::vector. */
export function aLiteralVector(v: number[]): string {
  return `[${v.join(',')}]`;
}
