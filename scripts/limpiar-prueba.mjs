// Datos de prueba: tareas cuyo título empieza por 'prueba' y documentos cuyo nombre empieza por 'prueba' (sin distinguir mayúsculas).
// El filtro también alcanzaría datos reales con ese prefijo, así que por defecto solo los lista.
// Para borrar: npm run db:limpiar -- --confirmar (los fragmentos caen por ON DELETE CASCADE).
import pg from 'pg';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();
const url = process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error('Falta NOVAASSISTANT_POSTGRES_URL_NON_POOLING');
  process.exit(1);
}

const FILTRO_TAREAS = "titulo ILIKE 'prueba%'"; // sin distinguir mayúsculas: "Prueba…" y "prueba…"
const FILTRO_DOCUMENTOS = "nombre_archivo ILIKE 'prueba%'";
const confirmar = process.argv.includes('--confirmar');

const c = new pg.Client(opcionesConexion(url));
try {
  await c.connect();
  if (confirmar) {
    const tareas = await c.query(`DELETE FROM tareas_personales WHERE ${FILTRO_TAREAS}`);
    const documentos = await c.query(`DELETE FROM documentos WHERE ${FILTRO_DOCUMENTOS}`);
    console.log(`Tareas borradas: ${tareas.rowCount}`);
    console.log(`Documentos borrados: ${documentos.rowCount}`);
  } else {
    const tareas = await c.query(`SELECT titulo FROM tareas_personales WHERE ${FILTRO_TAREAS}`);
    const documentos = await c.query(`SELECT nombre_archivo FROM documentos WHERE ${FILTRO_DOCUMENTOS}`);
    console.log(`Tareas que se borrarían: ${tareas.rowCount}`);
    tareas.rows.forEach((f) => console.log(`  ${f.titulo}`));
    console.log(`Documentos que se borrarían: ${documentos.rowCount}`);
    documentos.rows.forEach((f) => console.log(`  ${f.nombre_archivo}`));
    console.log('No se borró nada. Para borrar: npm run db:limpiar -- --confirmar');
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => {});
}
