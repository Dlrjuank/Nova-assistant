// Verifica extensión, tablas, restricciones, RLS y búsqueda vectorial. Pruebas dentro de una transacción con ROLLBACK.
import pg from 'pg';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();
const url = process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error('Falta NOVAASSISTANT_POSTGRES_URL_NON_POOLING');
  process.exit(1);
}

const DIM = 768;
const vec = (pos) => `[${Array.from({ length: DIM }, (_, i) => (i === pos ? 1 : 0)).join(',')}]`;
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const TABLAS = ['tareas_personales', 'documentos', 'fragmentos_pdf', 'fuentes_web', 'conversaciones', 'mensajes_chat'];

let fallas = 0;
const marcar = (ok, texto) => {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}`);
};

const c = new pg.Client(opcionesConexion(url));
await c.connect();

try {
  console.log('== 1. Extensión');
  const ext = await c.query("SELECT extversion FROM pg_extension WHERE extname='vector'");
  marcar(ext.rowCount === 1, `extensión vector instalada${ext.rowCount ? ` (v${ext.rows[0].extversion})` : ''}`);

  console.log('== 2. Existencia');
  for (const t of TABLAS) {
    const r = await c.query('SELECT to_regclass($1) AS r', [`public.${t}`]);
    marcar(r.rows[0].r !== null, `tabla ${t}`);
  }
  const fn = await c.query("SELECT 1 FROM pg_proc WHERE proname='buscar_fragmentos'");
  marcar(fn.rowCount > 0, 'función buscar_fragmentos');

  console.log('== 3. Filas por tabla');
  for (const t of TABLAS) {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    console.log(`     ${t}: ${r.rows[0].n}`);
  }

  console.log('== 4. Restricciones e índice');
  const cons = await c.query(
    "SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.tareas_personales'::regclass ORDER BY conname",
  );
  for (const r of cons.rows) console.log(`     ${r.conname}: ${r.def}`);
  const idx = await c.query("SELECT indexdef FROM pg_indexes WHERE indexname='idx_fragmentos_vector'");
  marcar(idx.rowCount === 1, 'índice idx_fragmentos_vector');

  console.log('== 5. RLS');
  const rls = await c.query(
    'SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY($1) AND relnamespace = $2::regnamespace',
    [TABLAS, 'public'],
  );
  for (const t of TABLAS) {
    marcar(rls.rows.find((r) => r.relname === t)?.relrowsecurity === true, `RLS activo en ${t}`);
  }

  console.log('== 6. Integridad (transacción con ROLLBACK)');
  await c.query('BEGIN');
  const esperaFalla = async (nombre, codigo, sql, params = []) => {
    await c.query('SAVEPOINT caso');
    try {
      await c.query(sql, params);
      marcar(false, `${nombre}: debía fallar con ${codigo} y se insertó`);
    } catch (e) {
      marcar(e.code === codigo, `${nombre}: ${e.code} (${e.constraint ?? e.message})`);
    }
    await c.query('ROLLBACK TO SAVEPOINT caso');
  };
  const insTarea = 'INSERT INTO tareas_personales (titulo, prioridad, fecha_limite, fecha_creacion) VALUES ($1,$2,$3,$3)';

  try {
    const a = await c.query(
      "INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion) VALUES ('Verif',$1,$1) RETURNING estado, prioridad",
      [hoy],
    );
    marcar(a.rows[0].estado === 'Pendiente' && a.rows[0].prioridad === 2, 'a) tarea válida: Pendiente, prioridad 2 por defecto');
  } catch (e) {
    marcar(false, `a) tarea válida: ${e.message}`);
  }

  await esperaFalla('b) prioridad 5', '23514', insTarea, ['Verif', 5, hoy]);
  await esperaFalla('c) prioridad 0', '23514', insTarea, ['Verif', 0, hoy]);
  await esperaFalla(
    'd) Completada sin fecha_cierre',
    '23514',
    "INSERT INTO tareas_personales (titulo, estado, fecha_limite, fecha_creacion) VALUES ('Verif','Completada',$1,$1)",
    [hoy],
  );

  let docId;
  try {
    docId = (
      await c.query("INSERT INTO documentos (nombre_archivo, fecha_guardado) VALUES ('verif.pdf',$1) RETURNING id", [hoy])
    ).rows[0].id;
    await c.query('INSERT INTO fragmentos_pdf (documento_id, numero, contenido, vector) VALUES ($1,1,$2,$3::vector)', [docId, 'uno', vec(0)]);
    await c.query('INSERT INTO fragmentos_pdf (documento_id, numero, contenido, vector) VALUES ($1,2,$2,$3::vector)', [docId, 'dos', vec(1)]);
    marcar(true, 'e) documento y 2 fragmentos de 768 dimensiones');
  } catch (e) {
    marcar(false, `e) documento y fragmentos: ${e.message}`);
  }

  try {
    // consulta cercana a la posición 0: el fragmento 1 debe ir primero
    const q = Array.from({ length: DIM }, (_, i) => (i === 0 ? 1 : i === 1 ? 0.2 : 0));
    const todas = await c.query('SELECT documento_id, numero, distancia FROM buscar_fragmentos($1::vector, 4)', [`[${q.join(',')}]`]);
    const orden = todas.rows.every((f, i) => i === 0 || todas.rows[i - 1].distancia <= f.distancia);
    // Solo cuentan los fragmentos de prueba: la base puede tener documentos reales.
    const r = todas.rows.filter((f) => f.documento_id === docId);
    marcar(r.length === 2 && orden && todas.rows[0].documento_id === docId && r[0].numero === 1, `f) buscar_fragmentos: ${r.map((x) => `#${x.numero}@${Number(x.distancia).toFixed(4)}`).join(', ')}`);
  } catch (e) {
    marcar(false, `f) buscar_fragmentos: ${e.message}`);
  }

  if (docId) {
    await esperaFalla(
      'g) fragmento duplicado (documento, numero)',
      '23505',
      'INSERT INTO fragmentos_pdf (documento_id, numero, contenido, vector) VALUES ($1,1,$2,$3::vector)',
      [docId, 'dup', vec(2)],
    );
  }
  // h) e i) RN-20: un mensaje no puede quedar con un usuario distinto al de su conversación.
  const usuario = (await c.query('SELECT id FROM auth.users LIMIT 1')).rows[0]?.id;
  if (usuario) {
    const conv = (await c.query('INSERT INTO conversaciones (usuario_id) VALUES ($1) RETURNING id', [usuario])).rows[0].id;
    const insMensaje = 'INSERT INTO mensajes_chat (conversacion_id, usuario_id, autor, texto) VALUES ($1,$2,$3,$4)';
    try {
      await c.query(insMensaje, [conv, usuario, 'usuario', 'hola']);
      marcar(true, 'h) mensaje en la conversación de su usuario');
    } catch (e) {
      marcar(false, `h) mensaje válido: ${e.message}`);
    }
    await esperaFalla('i) mensaje con otro usuario', '23503', insMensaje, [conv, '00000000-0000-4000-8000-000000000000', 'usuario', 'x']);
    await esperaFalla('j) autor inválido', '23514', insMensaje, [conv, usuario, 'sistema', 'x']);
  } else {
    console.log('     h-j) omitidas: no hay usuarios en auth.users');
  }
  await c.query('ROLLBACK');

  console.log(`== 7. Total de fallas: ${fallas}`);
} catch (e) {
  console.error('Error inesperado:', e.message);
  fallas++;
  await c.query('ROLLBACK').catch(() => {});
} finally {
  await c.end().catch(() => {});
}
process.exit(fallas ? 1 : 0);
