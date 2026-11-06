// Copia de seguridad de los datos de Nova en CSV, con la conexión directa.
// Uso: node scripts/respaldo.mjs  → respaldos/AAAA-MM-DD_HHMMSS/<tabla>.csv + manifiesto.json
// La carpeta respaldos/ está en .gitignore: contiene el texto de los documentos. Nunca se sube a git.
// Formato CSV como COPY de Postgres: campo vacío sin comillas = NULL; "" = texto vacío.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

// En orden de dependencias (padres primero); la restauración usa el mismo orden.
const TABLAS = ['tareas_personales', 'documentos', 'fragmentos_pdf', 'fuentes_web', 'conversaciones', 'mensajes_chat'];

cargarEnv();
const url = process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error('Falta NOVAASSISTANT_POSTGRES_URL_NON_POOLING');
  process.exit(1);
}

// Todos los valores como el texto que da Postgres (fechas con microsegundos, vectores "[...]", JSON tal cual).
const comoTexto = { getTypeParser: () => (valor) => valor };

function campo(valor) {
  if (valor === null) return '';
  return `"${String(valor).replace(/"/g, '""')}"`;
}

const ahora = new Date();
const marca = ahora.toISOString().replace('T', '_').replace(/[:]/g, '').slice(0, 17);
const carpeta = join(process.cwd(), 'respaldos', marca);
mkdirSync(carpeta, { recursive: true });

const cliente = new pg.Client(opcionesConexion(url));
try {
  await cliente.connect();
  // Una sola instantánea coherente de todas las tablas.
  await cliente.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const manifiesto = { creado_en: ahora.toISOString(), tablas: {} };
  for (const tabla of TABLAS) {
    const r = await cliente.query({ text: `SELECT * FROM ${tabla} ORDER BY 1`, types: comoTexto });
    const columnas = r.fields.map((f) => f.name);
    const lineas = [columnas.join(',')];
    for (const fila of r.rows) lineas.push(columnas.map((c) => campo(fila[c])).join(','));
    writeFileSync(join(carpeta, `${tabla}.csv`), lineas.join('\n') + '\n', 'utf8');
    manifiesto.tablas[tabla] = { filas: r.rowCount, columnas };
    console.log(`${tabla.padEnd(18)} ${r.rowCount} filas`);
  }
  await cliente.query('COMMIT');
  writeFileSync(join(carpeta, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2), 'utf8');
  console.log(`Respaldo en ${carpeta}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end().catch(() => {});
}
