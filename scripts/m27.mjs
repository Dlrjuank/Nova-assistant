// E21: ensayo y reverso de M27 (quitar el dueño por defecto). M27 se APLICA con db:migrar
// (pasos en supabase/pendientes/README.md), no con este script.
//   node scripts/m27.mjs --ensayo                 aplica M27 y su reverso en una transacción que SIEMPRE se revierte
//   node scripts/m27.mjs --revertir --confirmar   deshace una M27 ya aplicada
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

const NOMBRE = '20261128100000_nova_quitar_dueno_por_defecto.sql';
const TABLAS = ['tareas_personales', 'documentos', 'fuentes_web'];

const banderas = process.argv.slice(2);
const ensayo = banderas.includes('--ensayo');
const revertir = banderas.includes('--revertir') && banderas.includes('--confirmar');
if (ensayo === revertir) {
  console.error('Uso: node scripts/m27.mjs --ensayo | --revertir --confirmar');
  process.exit(1);
}

const leer = (...partes) => readFileSync(join(process.cwd(), 'supabase', ...partes), 'utf8');
const migracion = () => leer(existsSync(join(process.cwd(), 'supabase', 'migrations', NOMBRE)) ? 'migrations' : 'pendientes', NOMBRE);
const reverso = leer('reversos', 'M27_reverso.sql');

cargarEnv();
const url = process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error('Falta NOVAASSISTANT_POSTGRES_URL_NON_POOLING');
  process.exit(1);
}

const c = new pg.Client(opcionesConexion(url));
let fallas = 0;
const marcar = (ok, texto) => {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}`);
};

async function estado() {
  const r = await c.query(
    `SELECT to_regclass('public.nova_config') IS NOT NULL AS config,
            (SELECT count(*)::int FROM pg_trigger WHERE tgname LIKE '%\\_dueno\\_por\\_defecto' AND NOT tgisinternal) AS disparadores,
            (SELECT count(*)::int FROM pg_proc WHERE proname = 'asignar_dueno_por_defecto') AS funcion,
            (SELECT count(*)::int FROM information_schema.columns
              WHERE table_schema = 'public' AND column_name = 'usuario_id' AND table_name = ANY($1) AND is_nullable = 'NO') AS obligatorias`,
    [TABLAS],
  );
  return r.rows[0];
}
const esAntes = (e) => e.config && e.disparadores === 3 && e.funcion === 1 && e.obligatorias === 0;
const esDespues = (e) => !e.config && e.disparadores === 0 && e.funcion === 0 && e.obligatorias === 3;
const contar = async () =>
  (await c.query('SELECT (SELECT count(*) FROM tareas_personales)::int AS t, (SELECT count(*) FROM documentos)::int AS d, (SELECT count(*) FROM fuentes_web)::int AS f')).rows[0];

try {
  await c.connect();
  await c.query('BEGIN');
  // Si algo tiene tomadas las tablas, mejor desistir que dejar esperando a producción.
  await c.query("SET LOCAL lock_timeout = '3s'");
  if (ensayo) {
    const antes = await estado();
    marcar(esAntes(antes), 'estado de partida: dueño por defecto activo y usuario_id opcional');
    const filas = JSON.stringify(await contar());
    await c.query(migracion());
    marcar(esDespues(await estado()), 'M27: sin disparador, función ni nova_config; usuario_id obligatorio en las tres tablas');
    await c.query('SAVEPOINT caso');
    try {
      await c.query("INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion) VALUES ('ensayo M27', CURRENT_DATE, CURRENT_DATE)");
      marcar(false, 'M27: una tarea sin dueño debía rechazarse');
    } catch (e) {
      marcar(e.code === '23502', `M27: una tarea sin dueño se rechaza (${e.code})`);
    }
    await c.query('ROLLBACK TO SAVEPOINT caso');
    await c.query(reverso);
    marcar(esAntes(await estado()), 'reverso: queda como antes de M27');
    const repuesto = (await c.query(
      "INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion) VALUES ('ensayo M27', CURRENT_DATE, CURRENT_DATE) RETURNING id, usuario_id = (SELECT usuario_id FROM cuentas WHERE nivel = 'dueno') AS dueno",
    )).rows[0];
    marcar(repuesto.dueno === true, 'reverso: una tarea sin dueño (como el código anterior) vuelve a quedar con el dueño');
    await c.query('DELETE FROM tareas_personales WHERE id = $1', [repuesto.id]);
    marcar(JSON.stringify(await contar()) === filas, `ninguna fila cambió de cantidad (${filas})`);
    await c.query('ROLLBACK');
    marcar(esAntes(await estado()), 'ensayo revertido: la base no cambió');
  } else {
    await c.query(reverso);
    marcar(esAntes(await estado()), 'reverso aplicado');
    await c.query(fallas ? 'ROLLBACK' : 'COMMIT');
    if (!fallas) console.log(`Mueve supabase/migrations/${NOMBRE} a supabase/pendientes/ para que db:migrar no la repita.`);
  }
} catch (error) {
  fallas++;
  console.error(`Error (no se escribió nada): ${error.message}`);
  await c.query('ROLLBACK').catch(() => {});
} finally {
  await c.end().catch(() => {});
}
console.log(`Total de fallas: ${fallas}`);
process.exitCode = fallas ? 1 : 0;
