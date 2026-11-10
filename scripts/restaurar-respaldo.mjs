// Restaura un respaldo de scripts/respaldo.mjs, con la conexión directa.
// Uso: node scripts/restaurar-respaldo.mjs respaldos/<carpeta>              → solo compara (no escribe)
//      node scripts/restaurar-respaldo.mjs respaldos/<carpeta> --confirmar  → inserta lo que falte
//      node scripts/restaurar-respaldo.mjs respaldos/<carpeta> --probar     → simulacro: vacía las tablas,
//        restaura todo y compara, dentro de una transacción que siempre se revierte (no cambia nada)
// Solo agrega filas cuyo id no existe (ON CONFLICT DO NOTHING): no borra ni sobrescribe nada.
// Todo en una transacción: si algo falla, no queda nada a medias.
// Funciona también después de E01: las columnas que no están en el CSV (usuario_id) toman su valor
// por defecto o el del disparador de dueño por defecto.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';
import { TABLAS_RESPALDO } from './tablas-respaldo.mjs';

const LOTE = 200;

const [carpeta, bandera] = process.argv.slice(2);
if (!carpeta) {
  console.error('Uso: node scripts/restaurar-respaldo.mjs respaldos/<carpeta> [--confirmar]');
  process.exit(1);
}
const confirmar = bandera === '--confirmar';
const probar = bandera === '--probar';

// Un respaldo anterior puede no traer las tablas agregadas después: esas se dejan como están.
const TABLAS = TABLAS_RESPALDO.filter((tabla) => existsSync(join(carpeta, `${tabla}.csv`)));
const omitidas = TABLAS_RESPALDO.filter((tabla) => !TABLAS.includes(tabla));
if (omitidas.length > 0) console.log(`Este respaldo no trae: ${omitidas.join(', ')}. No se tocan.`);

// CSV como COPY de Postgres: campo vacío sin comillas = NULL; entre comillas = texto (puede tener saltos de línea).
function leerCsv(texto) {
  const filas = [];
  let fila = [];
  let i = 0;
  while (i < texto.length) {
    let valor;
    if (texto[i] === '"') {
      let s = '';
      i++;
      while (true) {
        const j = texto.indexOf('"', i);
        if (j === -1) throw new Error('CSV mal formado: comilla sin cerrar');
        s += texto.slice(i, j);
        if (texto[j + 1] === '"') { s += '"'; i = j + 2; } else { i = j + 1; break; }
      }
      valor = s;
    } else {
      let j = i;
      while (j < texto.length && texto[j] !== ',' && texto[j] !== '\n') j++;
      const s = texto.slice(i, j);
      valor = s === '' ? null : s;
      i = j;
    }
    fila.push(valor);
    if (texto[i] === ',') { i++; continue; }
    filas.push(fila);
    fila = [];
    i++; // salto de línea o fin
  }
  return filas;
}

cargarEnv();
const url = process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error('Falta NOVAASSISTANT_POSTGRES_URL_NON_POOLING');
  process.exit(1);
}

const cliente = new pg.Client(opcionesConexion(url));
try {
  await cliente.connect();
  await cliente.query('BEGIN');
  if (probar) await cliente.query(`DELETE FROM ${[...TABLAS].reverse().join('; DELETE FROM ')}`);
  for (const tabla of TABLAS) {
    const [encabezado, ...datos] = leerCsv(readFileSync(join(carpeta, `${tabla}.csv`), 'utf8'));
    // Tipo real de cada columna: cada valor se convierte desde su texto (como lo exportó Postgres).
    const { rows: tipos } = await cliente.query(
      `SELECT attname, format_type(atttypid, atttypmod) AS tipo FROM pg_attribute
       WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped`,
      [tabla],
    );
    const tipoDe = Object.fromEntries(tipos.map((t) => [t.attname, t.tipo]));
    const columnas = encabezado.map((c) => `"${c}"`).join(', ');
    const valores = encabezado.map((c) => `(e->>'${c}')::${tipoDe[c]}`).join(', ');
    let insertadas = 0;
    for (let k = 0; k < datos.length; k += LOTE) {
      const objetos = datos.slice(k, k + LOTE).map((f) => Object.fromEntries(encabezado.map((c, n) => [c, f[n]])));
      const r = await cliente.query(
        `INSERT INTO ${tabla} (${columnas}) OVERRIDING SYSTEM VALUE
         SELECT ${valores} FROM json_array_elements($1::json) e
         ON CONFLICT DO NOTHING`,
        [JSON.stringify(objetos)],
      );
      insertadas += r.rowCount;
    }
    console.log(`${tabla.padEnd(18)} ${datos.length} en el respaldo, ${insertadas} faltaban`);
    if (probar && insertadas !== datos.length) throw new Error(`simulacro: ${tabla} restauró ${insertadas} de ${datos.length}`);
  }
  await cliente.query(
    "SELECT setval(pg_get_serial_sequence('mensajes_chat', 'id'), GREATEST((SELECT max(id) FROM mensajes_chat), 1))",
  );
  if (confirmar && !probar) {
    await cliente.query('COMMIT');
    console.log('Restauración aplicada.');
  } else {
    await cliente.query('ROLLBACK');
    console.log(probar
      ? 'Simulacro correcto: todo se restauró y se revirtió; la base no cambió.'
      : 'Solo comparación: no se escribió nada. Para restaurar, agregue --confirmar.');
  }
} catch (error) {
  await cliente.query('ROLLBACK').catch(() => {});
  console.error(`Error (no se escribió nada): ${error.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end().catch(() => {});
}
