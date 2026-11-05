// Aplica en orden alfabético las migraciones de supabase/migrations/ no registradas en _migrations.
// Usa la conexión directa (no el pooler): NOVAASSISTANT_POSTGRES_URL_NON_POOLING.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();
const url = process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error('Falta NOVAASSISTANT_POSTGRES_URL_NON_POOLING');
  process.exit(1);
}

const carpeta = join(process.cwd(), 'supabase', 'migrations');
const archivos = readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort();
const cliente = new pg.Client(opcionesConexion(url));

try {
  await cliente.connect();
  await cliente.query(
    'CREATE TABLE IF NOT EXISTS _migrations (nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  );
  const { rows } = await cliente.query('SELECT nombre FROM _migrations');
  const hechas = new Set(rows.map((r) => r.nombre));

  for (const archivo of archivos) {
    if (hechas.has(archivo)) {
      console.log(`omitida   ${archivo}`);
      continue;
    }
    const sql = readFileSync(join(carpeta, archivo), 'utf8');
    try {
      await cliente.query('BEGIN');
      await cliente.query(sql);
      await cliente.query('INSERT INTO _migrations (nombre) VALUES ($1)', [archivo]);
      await cliente.query('COMMIT');
      console.log(`aplicada  ${archivo}`);
    } catch (error) {
      await cliente.query('ROLLBACK');
      console.error(`FALLÓ ${archivo}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }
} catch (error) {
  console.error(`Error de conexión: ${error.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end().catch(() => {});
}
