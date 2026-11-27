// Verifica extensión, tablas, restricciones, RLS y búsqueda vectorial. Pruebas dentro de una transacción con ROLLBACK.
// Sirve antes y después de M27 (E21). Con --con-m27 aplica M27 dentro de esa transacción y verifica el estado final
// sin cambiar la base (bloquea las tres tablas con dueño mientras dura, unos segundos).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  if (process.argv.includes('--con-m27')) {
    await c.query("SET LOCAL lock_timeout = '3s'");
    await c.query(readFileSync(join(process.cwd(), 'supabase', 'pendientes', '20261128100000_nova_quitar_dueno_por_defecto.sql'), 'utf8'));
    console.log('     (M27 aplicada solo dentro de esta transacción)');
  }
  // El dueño sale de cuentas (M25): nova_config desaparece con M27.
  const dueno = (await c.query("SELECT usuario_id FROM cuentas WHERE nivel = 'dueno'")).rows[0]?.usuario_id;
  marcar(Boolean(dueno), 'hay una cuenta dueña');
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
  const insTarea = 'INSERT INTO tareas_personales (titulo, prioridad, fecha_limite, fecha_creacion, usuario_id) VALUES ($1,$2,$3,$3,$4)';

  try {
    const a = await c.query(
      "INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion, usuario_id) VALUES ('Verif',$1,$1,$2) RETURNING estado, prioridad",
      [hoy, dueno],
    );
    marcar(a.rows[0].estado === 'Pendiente' && a.rows[0].prioridad === 2, 'a) tarea válida: Pendiente, prioridad 2 por defecto');
  } catch (e) {
    marcar(false, `a) tarea válida: ${e.message}`);
  }

  await esperaFalla('b) prioridad 5', '23514', insTarea, ['Verif', 5, hoy, dueno]);
  await esperaFalla('c) prioridad 0', '23514', insTarea, ['Verif', 0, hoy, dueno]);
  await esperaFalla(
    'd) Completada sin fecha_cierre',
    '23514',
    "INSERT INTO tareas_personales (titulo, estado, fecha_limite, fecha_creacion, usuario_id) VALUES ('Verif','Completada',$1,$1,$2)",
    [hoy, dueno],
  );

  let docId;
  try {
    docId = (
      await c.query("INSERT INTO documentos (nombre_archivo, fecha_guardado, usuario_id) VALUES ('verif.pdf',$1,$2) RETURNING id", [hoy, dueno])
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

  // M5 (ampliación, E01): dueño en tareas, documentos y fuentes web, sin romper el código de master.
  console.log('== 6b. Dueño por usuario (M5)');
  const conDueno = ['tareas_personales', 'documentos', 'fuentes_web'];
  const cols = await c.query(
    "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='usuario_id' AND table_name = ANY($1)",
    [conDueno],
  );
  for (const t of conDueno) marcar(cols.rows.some((r) => r.table_name === t), `columna usuario_id en ${t}`);
  // M27 (E21) quita nova_config y el disparador, y hace obligatorio usuario_id. Se verifica el estado que haya.
  const hayConfig = (await c.query("SELECT to_regclass('public.nova_config') IS NOT NULL AS hay")).rows[0].hay;
  const disp = await c.query(
    "SELECT tgname FROM pg_trigger WHERE tgname IN ('tareas_dueno_por_defecto','documentos_dueno_por_defecto','fuentes_dueno_por_defecto') AND NOT tgisinternal",
  );
  const obligatorias = await c.query(
    "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='usuario_id' AND is_nullable = 'NO' AND table_name = ANY($1)",
    [conDueno],
  );
  if (hayConfig) {
    console.log('     (antes de M27)');
    const valor = (await c.query("SELECT valor FROM nova_config WHERE clave='dueno_por_defecto'")).rows[0]?.valor;
    marcar(valor === dueno, 'nova_config.dueno_por_defecto es la cuenta dueña');
    const rlsConfig = await c.query("SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.nova_config')");
    marcar(rlsConfig.rows[0]?.relrowsecurity === true, 'RLS activo en nova_config');
    marcar(disp.rowCount === 3, `disparadores de dueño por defecto (${disp.rowCount} de 3; temporales, los quita M27)`);
    marcar(obligatorias.rowCount === 0, 'usuario_id todavía opcional (el código anterior no lo envía)');
  } else {
    console.log('     (después de M27)');
    marcar(disp.rowCount === 0, `M27: sin disparadores de dueño por defecto (${disp.rowCount})`);
    marcar((await c.query("SELECT 1 FROM pg_proc WHERE proname = 'asignar_dueno_por_defecto'")).rowCount === 0, 'M27: sin la función asignar_dueno_por_defecto');
    marcar(obligatorias.rowCount === 3, `M27: usuario_id obligatorio (${obligatorias.rowCount} de 3)`);
    await esperaFalla('M27: tarea sin dueño', '23502', "INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion) VALUES ('Verificación', $1, $1)", [hoy]);
    await esperaFalla('M27: documento sin dueño', '23502', "INSERT INTO documentos (nombre_archivo, fecha_guardado) VALUES ('x.pdf', $1)", [hoy]);
    await esperaFalla('M27: fuente sin dueño', '23502', "INSERT INTO fuentes_web (categoria, url, extracto, fecha_guardado) VALUES ('Verificación','u','e',$1)", [hoy]);
  }
  const idxDueno = await c.query(
    "SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_tareas_usuario','idx_documentos_usuario','idx_fuentes_usuario')",
  );
  marcar(idxDueno.rowCount === 3, `índices por usuario (${idxDueno.rowCount} de 3)`);
  const fnUsuario = await c.query("SELECT 1 FROM pg_proc WHERE proname='buscar_fragmentos_usuario'");
  marcar(fnUsuario.rowCount > 0, 'función buscar_fragmentos_usuario');
  const sinDueno = await c.query(
    `SELECT (SELECT COUNT(*) FROM tareas_personales WHERE usuario_id IS NULL)
          + (SELECT COUNT(*) FROM documentos WHERE usuario_id IS NULL)
          + (SELECT COUNT(*) FROM fuentes_web WHERE usuario_id IS NULL) AS n`,
  );
  marcar(Number(sinDueno.rows[0].n) === 0, `ninguna fila sin dueño (${sinDueno.rows[0].n})`);

  if (dueno && docId) {
    try {
     if (hayConfig) {
      // k) Como el código anterior: INSERT sin usuario_id → el disparador pone el dueño por defecto.
      const docDueno = (await c.query("INSERT INTO documentos (nombre_archivo, fecha_guardado) VALUES ('verif-k.pdf',$1) RETURNING usuario_id", [hoy])).rows[0].usuario_id;
      const tareaMaster = (
        await c.query(
          "INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion) VALUES ('Verificación', $1, $1) RETURNING usuario_id",
          [hoy],
        )
      ).rows[0].usuario_id;
      const fuenteMaster = (
        await c.query(
          "INSERT INTO fuentes_web (categoria, url, extracto, fecha_guardado) VALUES ('Verificación','u','e',$1) RETURNING usuario_id",
          [hoy],
        )
      ).rows[0].usuario_id;
      marcar(docDueno === dueno && tareaMaster === dueno && fuenteMaster === dueno, 'k) INSERT sin usuario_id (como el código anterior) queda con el dueño por defecto');
     }

      // l) Como el código nuevo: un usuario_id explícito se respeta.
      const otro = (await c.query('SELECT id FROM auth.users WHERE id <> $1 LIMIT 1', [dueno])).rows[0]?.id;
      if (otro) {
        const tareaOtro = (
          await c.query(
            "INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion, usuario_id) VALUES ('Verificación', $1, $1, $2) RETURNING usuario_id",
            [hoy, otro],
          )
        ).rows[0].usuario_id;
        marcar(tareaOtro === otro, 'l) INSERT con usuario_id explícito lo conserva');

        // m) La búsqueda por usuario solo devuelve fragmentos de sus documentos.
        const q = vec(0);
        // Límite amplio: la cuenta del dueño puede tener documentos reales que compitan con los de prueba.
        const delDueno = await c.query('SELECT documento_id FROM buscar_fragmentos_usuario($1::vector, 500, $2)', [q, dueno]);
        const delOtro = await c.query('SELECT documento_id FROM buscar_fragmentos_usuario($1::vector, 4, $2)', [q, otro]);
        marcar(
          delDueno.rows.filter((f) => f.documento_id === docId).length === 2 && !delOtro.rows.some((f) => f.documento_id === docId),
          `m) buscar_fragmentos_usuario: dueño ${delDueno.rows.filter((f) => f.documento_id === docId).length} de 2, otro usuario 0`,
        );
      } else {
        console.log('     l-m) omitidas: solo hay un usuario en auth.users');
      }
    } catch (e) {
      marcar(false, `k-m) dueño: ${e.message}`);
    }
  }
  // M6 (ampliación, E05): categorías por usuario con color de la paleta fija.
  console.log('== 6c. Categorías (M6)');
  const hayCategorias = (await c.query("SELECT to_regclass('public.categorias') AS r")).rows[0].r !== null;
  marcar(hayCategorias, 'tabla categorias');
  if (hayCategorias) {
    const rlsCat = await c.query("SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.categorias')");
    marcar(rlsCat.rows[0]?.relrowsecurity === true, 'RLS activo en categorias');
    const idxCat = await c.query("SELECT 1 FROM pg_indexes WHERE indexname = 'categorias_nombre_unico'");
    marcar(idxCat.rowCount === 1, 'índice único (usuario, nombre sin distinguir mayúsculas)');
    if (dueno) {
      await c.query("INSERT INTO categorias (usuario_id, nombre, color) VALUES ($1, 'Verificación Cat', 'azul') ON CONFLICT DO NOTHING", [dueno]);
      await esperaFalla('n) categoría repetida con otras mayúsculas', '23505', "INSERT INTO categorias (usuario_id, nombre, color) VALUES ($1, 'VERIFICACIÓN CAT', 'rosa')", [dueno]);
      await esperaFalla('o) color fuera de la paleta', '23514', "INSERT INTO categorias (usuario_id, nombre, color) VALUES ($1, 'Otra verificación', 'negro')", [dueno]);
      await esperaFalla('p) nombre con espacios alrededor', '23514', "INSERT INTO categorias (usuario_id, nombre, color) VALUES ($1, ' Otra ', 'azul')", [dueno]);
    }
  }
  // M14 (ampliación, E06b): horario opcional de las tareas (RB-34).
  console.log('== 6d. Horario de tareas (M14)');
  const colsHora = await c.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'tareas_personales' AND column_name IN ('hora_inicio', 'hora_fin')",
  );
  marcar(colsHora.rowCount === 2, `columnas hora_inicio y hora_fin (${colsHora.rowCount} de 2)`);
  if (colsHora.rowCount === 2) {
    const insHora = 'INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion, hora_inicio, hora_fin, usuario_id) VALUES ($1, $2, $2, $3, $4, $5)';
    try {
      await c.query(insHora, ['Verificación horario', hoy, '08:00', '09:30', dueno]);
      await c.query(insHora, ['Verificación solo inicio', hoy, '08:00', null, dueno]);
      marcar(true, 'q) horario completo y solo inicio se aceptan');
    } catch (e) {
      marcar(false, `q) horario válido: ${e.message}`);
    }
    await esperaFalla('r) hora de fin sin inicio', '23514', insHora, ['Verificación', hoy, null, '09:30', dueno]);
    await esperaFalla('s) hora de fin antes del inicio', '23514', insHora, ['Verificación', hoy, '10:00', '09:30', dueno]);
  }
  console.log('== 6e. Libros: páginas y capítulos (M15)');
  const colsLibro = await c.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE (table_name = 'documentos' AND column_name IN ('paginas', 'progreso', 'por_indexar', 'indexando_hasta'))
        OR (table_name = 'fragmentos_pdf' AND column_name IN ('pagina_inicio', 'pagina_fin', 'etiqueta_paginas'))`,
  );
  marcar(colsLibro.rowCount === 7, `columnas de páginas e indexación (${colsLibro.rowCount} de 7)`);
  const tablaCap = await c.query("SELECT to_regclass('public.capitulos') AS r");
  const hayCapitulos = tablaCap.rows[0].r !== null;
  marcar(hayCapitulos, 'tabla capitulos');
  if (hayCapitulos && colsLibro.rowCount === 7 && dueno && docId) {
    const rlsCap = await c.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'capitulos'");
    marcar(rlsCap.rows[0]?.relrowsecurity === true, 'RLS activo en capitulos');
    const nuevoDoc = async (nombre, extra = '', valores = []) =>
      (await c.query(`INSERT INTO documentos (nombre_archivo, fecha_guardado, usuario_id${extra ? ', paginas, progreso' : ''}) VALUES ($1, $2, $3${extra}) RETURNING id`, [nombre, hoy, dueno, ...valores])).rows[0].id;
    const insFrag = 'INSERT INTO fragmentos_pdf (documento_id, numero, contenido, vector, pagina_inicio, pagina_fin, etiqueta_paginas) VALUES ($1, $2, $3, $4::vector, $5, $6, $7)';
    try {
      const listo = await nuevoDoc('libro-listo.pdf', ', $4, NULL', [40]);
      const medias = await nuevoDoc('libro-a-medias.pdf', ', $4, $5', [40, 50]);
      await c.query(insFrag, [listo, 1, 'listo', vec(5), 45, 46, '45–46']);
      await c.query(insFrag, [medias, 1, 'a medias', vec(5), 1, 1, '1']);
      const q = Array.from({ length: DIM }, (_, i) => (i === 5 ? 1 : 0));
      const halladas = await c.query('SELECT contenido, etiqueta_paginas FROM buscar_fragmentos_usuario($1::vector, 500, $2::uuid)', [`[${q.join(',')}]`, dueno]);
      const conListo = halladas.rows.find((r) => r.contenido === 'listo');
      marcar(conListo?.etiqueta_paginas === '45–46', 't) la búsqueda por usuario devuelve la etiqueta de páginas');
      marcar(!halladas.rows.some((r) => r.contenido === 'a medias'), 'u) un documento a medio indexar no entra en la búsqueda (RB-38)');
      await c.query("INSERT INTO capitulos (documento_id, usuario_id, orden, titulo, pagina_inicio, pagina_fin, etiqueta_paginas) VALUES ($1, $2, 1, 'Uno', 1, 9, '1–9')", [listo, dueno]);
      marcar(true, 'v) capítulo válido');
      const insCap = 'INSERT INTO capitulos (documento_id, usuario_id, orden, titulo, pagina_inicio, pagina_fin, etiqueta_paginas) VALUES ($1, $2, $3, $4, $5, $6, $7)';
      await esperaFalla('w) capítulo con la página final antes de la inicial', '23514', insCap, [listo, dueno, 2, 'Mal', 9, 3, 'x']);
      await esperaFalla('x) capítulo de un documento con otro dueño', '23503', insCap, [listo, '00000000-0000-4000-8000-000000000000', 3, 'Ajeno', 1, 2, 'x']);
      await esperaFalla('y) orden repetido en el mismo documento', '23505', insCap, [listo, dueno, 1, 'Repetido', 1, 2, 'x']);
      await esperaFalla('z) más de 800 páginas', '23514', 'UPDATE documentos SET paginas = 801 WHERE id = $1', [listo]);
      await esperaFalla('aa) fragmento con la página final antes de la inicial', '23514', insFrag, [listo, 2, 'mal', vec(6), 9, 3, 'x']);
      await c.query('DELETE FROM documentos WHERE id = $1', [listo]);
      const quedan = await c.query('SELECT count(*)::int AS n FROM capitulos WHERE documento_id = $1', [listo]);
      marcar(quedan.rows[0].n === 0, 'ab) al eliminar el documento se borran sus capítulos');
    } catch (e) {
      marcar(false, `t-ab) libros: ${e.message}`);
    }
  }
  console.log('== 6f. Contexto de las respuestas (M19)');
  const colContexto = await c.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'mensajes_chat' AND column_name = 'contexto'");
  marcar(colContexto.rowCount === 1, 'columna mensajes_chat.contexto');
  const colInicios = await c.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'documentos' AND column_name = 'inicio_paginas'");
  marcar(colInicios.rowCount === 1, 'columna documentos.inicio_paginas (M20)');
  console.log('== 6g. Fuentes web en el Asistente y origen de los mensajes (M18, M21)');
  const colVectorWeb = await c.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'fuentes_web' AND column_name = 'vector'");
  marcar(colVectorWeb.rowCount === 1, 'columna fuentes_web.vector');
  const fnWeb = await c.query("SELECT 1 FROM pg_proc WHERE proname = 'buscar_fuentes_web_usuario'");
  marcar(fnWeb.rowCount === 1, 'función buscar_fuentes_web_usuario');
  const colOrigen = await c.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'mensajes_chat' AND column_name = 'origen'");
  marcar(colOrigen.rowCount === 1, 'columna mensajes_chat.origen');
  if (colVectorWeb.rowCount === 1 && fnWeb.rowCount === 1 && colOrigen.rowCount === 1 && dueno) {
    try {
      const insFuente = "INSERT INTO fuentes_web (categoria, url, extracto, fecha_guardado, usuario_id, vector) VALUES ('Verificación', $1, 'e', $2, $3, $4::vector) RETURNING id";
      const cercana = (await c.query(insFuente, ['https://es.wikipedia.org/wiki/A', hoy, dueno, vec(7)])).rows[0].id;
      await c.query(insFuente, ['https://es.wikipedia.org/wiki/B', hoy, dueno, vec(8)]);
      await c.query("INSERT INTO fuentes_web (categoria, url, extracto, fecha_guardado, usuario_id) VALUES ('Verificación', 'https://es.wikipedia.org/wiki/C', 'e', $1, $2)", [hoy, dueno]);
      const halladas = await c.query('SELECT id, url FROM buscar_fuentes_web_usuario($1::vector, 500, $2::uuid)', [vec(7), dueno]);
      marcar(halladas.rows[0]?.id === cercana, 'ac) la fuente más cercana va primero');
      marcar(!halladas.rows.some((f) => f.url.endsWith('/C')), 'ad) una fuente sin vector no entra en la búsqueda');
      const ajenas = await c.query('SELECT id FROM buscar_fuentes_web_usuario($1::vector, 500, $2::uuid)', [vec(7), '00000000-0000-4000-8000-000000000000']);
      marcar(ajenas.rowCount === 0, 'ae) otro usuario no ve esas fuentes');
      const convOrigen = (await c.query('INSERT INTO conversaciones (usuario_id) VALUES ($1) RETURNING id', [dueno])).rows[0].id;
      const insOrigen = "INSERT INTO mensajes_chat (conversacion_id, usuario_id, autor, texto, origen) VALUES ($1, $2, 'usuario', 'x', $3)";
      await c.query(insOrigen, [convOrigen, dueno, 'wikipedia']);
      await c.query(insOrigen, [convOrigen, dueno, null]);
      marcar(true, 'af) origen válido y sin origen se aceptan');
      await esperaFalla('ag) origen fuera de la lista', '23514', insOrigen, [convOrigen, dueno, 'otro']);
    } catch (e) {
      marcar(false, `ac-ag) fuentes web: ${e.message}`);
    }
  }
  console.log('== 6h. Cuestionarios (M17)');
  const TABLAS_CUESTIONARIO = ['cuestionarios', 'preguntas_cuestionario', 'intentos_cuestionario', 'respuestas_intento'];
  const rlsCuest = await c.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY($1) AND relkind = 'r'", [TABLAS_CUESTIONARIO]);
  for (const t of TABLAS_CUESTIONARIO) {
    const fila = rlsCuest.rows.find((r) => r.relname === t);
    marcar(Boolean(fila), `tabla ${t}`);
    marcar(fila?.relrowsecurity === true, `RLS activo en ${t}`);
  }
  if (rlsCuest.rowCount === 4 && dueno) {
    try {
      const doc = (await c.query("INSERT INTO documentos (nombre_archivo, fecha_guardado, usuario_id, paginas) VALUES ('cuestionario.pdf', $1, $2, 10) RETURNING id", [hoy, dueno])).rows[0].id;
      const insCuest = 'INSERT INTO cuestionarios (usuario_id, documento_id, alcance, dificultad, pedidas, pagina_desde, pagina_hasta) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id';
      const cuest = (await c.query(insCuest, [dueno, doc, 'paginas', 'media', 5, 2, 4])).rows[0].id;
      const insPreg = 'INSERT INTO preguntas_cuestionario (cuestionario_id, usuario_id, orden, enunciado, opciones, correcta, explicacion, cita_textual) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8) RETURNING id';
      const opciones = JSON.stringify(['a', 'b', 'c', 'd']);
      const preg = (await c.query(insPreg, [cuest, dueno, 1, '¿Uno?', opciones, 2, 'Porque sí.', 'una cita literal del texto'])).rows[0].id;
      const intento = (await c.query('INSERT INTO intentos_cuestionario (cuestionario_id, usuario_id, preguntas, total) VALUES ($1, $2, ARRAY[$3::uuid], 1) RETURNING id', [cuest, dueno, preg])).rows[0].id;
      const insResp = 'INSERT INTO respuestas_intento (intento_id, pregunta_id, usuario_id, elegida, acierto) VALUES ($1, $2, $3, $4, $5)';
      await c.query(insResp, [intento, preg, dueno, 2, true]);
      marcar(true, 'ah) cuestionario, pregunta, intento y respuesta válidos');
      const otro = '00000000-0000-4000-8000-000000000000';
      await esperaFalla('ai) cuestionario de un documento con otro dueño', '23503', insCuest, [otro, doc, 'documento', 'media', 5, null, null]);
      await esperaFalla('aj) cantidad distinta de 5, 10 o 20', '23514', insCuest, [dueno, doc, 'documento', 'media', 7, null, null]);
      await esperaFalla('ak) rango de páginas invertido', '23514', insCuest, [dueno, doc, 'paginas', 'media', 5, 4, 2]);
      await esperaFalla('al) dificultad fuera de la lista', '23514', insCuest, [dueno, doc, 'documento', 'extrema', 5, null, null]);
      await esperaFalla('am) respuesta correcta fuera de 0 a 3', '23514', insPreg, [cuest, dueno, 5, '¿Dos?', opciones, 4, 'x', 'una cita literal del texto']);
      await esperaFalla('an) menos de 4 opciones', '23514', insPreg, [cuest, dueno, 3, '¿Tres?', JSON.stringify(['a', 'b', 'c']), 0, 'x', 'una cita literal del texto']);
      await esperaFalla('ao) orden repetido en el cuestionario', '23505', insPreg, [cuest, dueno, 1, '¿Otra?', opciones, 0, 'x', 'una cita literal del texto']);
      await esperaFalla('ap) responder dos veces la misma pregunta (RB-51)', '23505', insResp, [intento, preg, dueno, 1, false]);
      const preg2 = (await c.query(insPreg, [cuest, dueno, 2, '¿Dos?', opciones, 0, 'x', 'una cita literal del texto'])).rows[0].id;
      await esperaFalla('aq) respuesta con otro dueño', '23503', insResp, [intento, preg2, otro, 1, false]);
      await esperaFalla('ar) total distinto de las preguntas del intento', '23514', 'INSERT INTO intentos_cuestionario (cuestionario_id, usuario_id, preguntas, total) VALUES ($1, $2, ARRAY[$3::uuid], 2)', [cuest, dueno, preg]);
      await c.query('DELETE FROM documentos WHERE id = $1', [doc]);
      const quedan = await c.query(
        'SELECT (SELECT count(*) FROM cuestionarios WHERE id = $1)::int + (SELECT count(*) FROM preguntas_cuestionario WHERE cuestionario_id = $1)::int + (SELECT count(*) FROM intentos_cuestionario WHERE cuestionario_id = $1)::int + (SELECT count(*) FROM respuestas_intento WHERE intento_id = $2)::int AS n',
        [cuest, intento],
      );
      marcar(quedan.rows[0].n === 0, 'as) al eliminar el documento se borran sus cuestionarios, preguntas, intentos y respuestas');
    } catch (e) {
      marcar(false, `ah-as) cuestionarios: ${e.message}`);
    }
  }
  console.log('== 6i. Preferencias del usuario (M7)');
  const rlsPref = await c.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'preferencias_usuario' AND relkind = 'r'");
  marcar(rlsPref.rowCount === 1, 'tabla preferencias_usuario');
  marcar(rlsPref.rows[0]?.relrowsecurity === true, 'RLS activo en preferencias_usuario');
  if (rlsPref.rowCount === 1 && dueno) {
    try {
      await c.query('DELETE FROM preferencias_usuario WHERE usuario_id = $1', [dueno]);
      const def = (await c.query('INSERT INTO preferencias_usuario (usuario_id) VALUES ($1) RETURNING tema, formato_hora, nota_aprobar::text AS nota, redondeo, cortes_defecto', [dueno])).rows[0];
      marcar(def.tema === 'automatico' && def.formato_hora === '24' && def.nota === '3.00' && def.redondeo === 'truncar' && def.cortes_defecto.join(',') === '3000,3000,4000', 'at) valores por defecto (automático, 24 h, 3,00, truncar, 30/30/40)');
      const upd = 'UPDATE preferencias_usuario SET {c} WHERE usuario_id = $1';
      await esperaFalla('au) tema fuera de la lista', '23514', upd.replace('{c}', "tema = 'azul'"), [dueno]);
      await esperaFalla('av) nota para aprobar mayor que 5', '23514', upd.replace('{c}', 'nota_aprobar = 5.5'), [dueno]);
      await esperaFalla('aw) cortes que no suman 100 %', '23514', upd.replace('{c}', "cortes_defecto = '{3000,3000}'"), [dueno]);
      await esperaFalla('ax) un corte de 0 %', '23514', upd.replace('{c}', "cortes_defecto = '{0,10000}'"), [dueno]);
      await esperaFalla('ay) formato de hora fuera de la lista', '23514', upd.replace('{c}', "formato_hora = '13'"), [dueno]);
      await c.query("UPDATE preferencias_usuario SET cortes_defecto = '{5000,5000}', nota_aprobar = 3.5, formato_hora = '12' WHERE usuario_id = $1", [dueno]);
      marcar(true, 'az) cambios válidos se aceptan');
    } catch (e) {
      marcar(false, `at-az) preferencias: ${e.message}`);
    }
  }
  console.log('== 6j. Recordatorios (M16)');
  const tablasM16 = await c.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('suscripciones_push', 'envios') AND relkind = 'r' ORDER BY relname");
  marcar(tablasM16.rowCount === 2, 'tablas suscripciones_push y envios');
  marcar(tablasM16.rows.every((r) => r.relrowsecurity === true), 'RLS activo en suscripciones_push y envios');
  const cron = await c.query("SELECT schedule FROM cron.job WHERE jobname = 'nova-recordatorios'").catch(() => ({ rowCount: 0, rows: [] }));
  marcar(cron.rowCount === 1 && cron.rows[0].schedule === '* * * * *', 'pg_cron: aviso nova-recordatorios cada minuto');
  marcar((await c.query("SELECT 1 FROM pg_proc WHERE proname = 'nova_llamar_tick'")).rowCount === 1, 'función nova_llamar_tick');
  if (tablasM16.rowCount === 2 && dueno) {
    try {
      const t = (await c.query(
        `INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion, usuario_id, hora_inicio) VALUES ('verificar M16', $1, $1, $2, '10:00') RETURNING id`,
        [hoy, dueno],
      )).rows[0].id;
      marcar((await c.query('SELECT recordatorio, recordatorio_en, recordatorio_estado FROM tareas_personales WHERE id = $1', [t])).rows[0].recordatorio === null, 'ba) una tarea sin recordatorio (como las de master) queda en NULL');
      const upd = 'UPDATE tareas_personales SET {c} WHERE id = $1';
      await esperaFalla('bb) recordatorio fuera de la lista', '23514', upd.replace('{c}', "recordatorio = '2_dias', recordatorio_en = now(), recordatorio_estado = 'pendiente'"), [t]);
      await esperaFalla('bc) recordatorio sin su momento', '23514', upd.replace('{c}', "recordatorio = 'a_la_hora'"), [t]);
      await esperaFalla('bd) estado fuera de la lista', '23514', upd.replace('{c}', "recordatorio = 'a_la_hora', recordatorio_en = now(), recordatorio_estado = 'listo'"), [t]);
      await esperaFalla('be) 15 min antes sin horario', '23514', upd.replace('{c}', "hora_inicio = NULL, recordatorio = '15_min', recordatorio_en = now(), recordatorio_estado = 'pendiente'"), [t]);
      await c.query(upd.replace('{c}', "recordatorio = '15_min', recordatorio_en = now(), recordatorio_estado = 'pendiente'"), [t]);
      marcar(true, 'bf) recordatorio válido con horario');
      const sus = "INSERT INTO suscripciones_push (usuario_id, endpoint, p256dh, auth) VALUES ($1, $2, 'a', 'b')";
      await c.query(sus, [dueno, 'https://push.ejemplo/verificar']);
      await esperaFalla('bg) la misma suscripción dos veces', '23505', sus, [dueno, 'https://push.ejemplo/verificar']);
      await esperaFalla('bh) suscripción sin https', '23514', sus, [dueno, 'http://push.ejemplo/x']);
      const res = "INSERT INTO envios (usuario_id, tipo, fecha, resultado) VALUES ($1, $2, $3, 'ok')";
      // Un día fijo del pasado: el de hoy puede tener ya un resumen de verdad del usuario.
      const diaPrueba = '2000-01-01';
      await c.query(res, [dueno, 'resumen', diaPrueba]);
      await esperaFalla('bi) dos resúmenes el mismo día', '23505', res, [dueno, 'resumen', diaPrueba]);
      await c.query(res, [dueno, 'recordatorio', hoy]);
      await c.query(res, [dueno, 'recordatorio', hoy]);
      marcar(true, 'bj) varios recordatorios el mismo día');
      const pref = (await c.query("INSERT INTO preferencias_usuario (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO UPDATE SET tema = preferencias_usuario.tema RETURNING to_char(hora_recordatorio, 'HH24:MI') AS h, resumen_diario, to_char(hora_resumen, 'HH24:MI') AS r", [dueno])).rows[0];
      marcar(pref.h === '08:00' && pref.resumen_diario === false && pref.r === '07:00', 'bk) preferencias nuevas por defecto (8:00, sin resumen, 7:00)');
    } catch (e) {
      marcar(false, `ba-bk) recordatorios: ${e.message}`);
    }
  }
  console.log('== 6k. Tareas creadas sin conexión (M23)');
  const columnaM23 = await c.query("SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'tareas_personales' AND column_name = 'id_cliente'");
  marcar(columnaM23.rowCount === 1 && columnaM23.rows[0].data_type === 'uuid' && columnaM23.rows[0].is_nullable === 'YES', 'columna tareas_personales.id_cliente (UUID, opcional)');
  if (columnaM23.rowCount === 1 && dueno) {
    try {
      const ins = `INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion, usuario_id, id_cliente) VALUES ('verificar M23', $1, $1, $2, $3) RETURNING id`;
      const sinCliente = (await c.query(`INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion, usuario_id) VALUES ('verificar M23', $1, $1, $2) RETURNING id_cliente`, [hoy, dueno])).rows[0];
      marcar(sinCliente.id_cliente === null, 'bl) una tarea creada como en master queda con id_cliente en NULL');
      await c.query(`INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion, usuario_id) VALUES ('verificar M23', $1, $1, $2)`, [hoy, dueno]);
      marcar(true, 'bm) varias tareas sin id_cliente del mismo usuario');
      const idCliente = '0b0e7c6a-1d2f-4e5a-9b8c-7d6e5f4a3b21';
      await c.query(ins, [hoy, dueno, idCliente]);
      await esperaFalla('bn) el mismo id_cliente dos veces para el mismo usuario', '23505', ins, [hoy, dueno, idCliente]);
    } catch (e) {
      marcar(false, `bl-bn) id_cliente: ${e.message}`);
    }
  }
  // M22 (ampliación, E10g): tipos de pregunta (6.18, 7.12, RB-64 a RB-69).
  console.log('== 6l. Tipos de pregunta (M22)');
  const columnasM22 = await c.query(
    `SELECT table_name || '.' || column_name AS c FROM information_schema.columns
     WHERE (table_name, column_name) IN (('cuestionarios','tipo'),('preguntas_cuestionario','tipo'),('preguntas_cuestionario','correctas'),('preguntas_cuestionario','verdadero'),
       ('preguntas_cuestionario','respuesta_texto'),('respuestas_intento','elegidas'),('respuestas_intento','texto'),('respuestas_intento','autoevaluacion'),('respuestas_intento','puntos'))`,
  );
  marcar(columnasM22.rowCount === 9, `columnas de M22 (${columnasM22.rowCount} de 9)`);
  const sinPuntos = await c.query('SELECT count(*)::int AS n FROM respuestas_intento WHERE puntos IS NULL AND acierto IS NOT NULL');
  marcar(sinPuntos.rows[0].n === 0, 'bo) las respuestas anteriores tienen sus puntos según el acierto');
  const anteriores = await c.query("SELECT count(*)::int AS n FROM preguntas_cuestionario WHERE tipo <> 'unica' AND correcta IS NOT NULL");
  marcar(anteriores.rows[0].n === 0, 'bp) las preguntas anteriores siguen como selección única');
  if (columnasM22.rowCount === 9 && dueno) {
    try {
      const doc = (await c.query("INSERT INTO documentos (nombre_archivo, fecha_guardado, usuario_id, paginas) VALUES ('tipos.pdf', $1, $2, 10) RETURNING id", [hoy, dueno])).rows[0].id;
      const insCuest = "INSERT INTO cuestionarios (usuario_id, documento_id, alcance, dificultad, pedidas, tipo) VALUES ($1, $2, 'documento', 'media', 5, $3) RETURNING id";
      const cuest = (await c.query(insCuest, [dueno, doc, 'mixto'])).rows[0].id;
      const sinTipo = (await c.query("INSERT INTO cuestionarios (usuario_id, documento_id, alcance, dificultad, pedidas) VALUES ($1, $2, 'documento', 'media', 5) RETURNING tipo", [dueno, doc])).rows[0];
      marcar(sinTipo.tipo === 'unica', 'bq) un cuestionario creado como antes queda de selección única');
      await esperaFalla('br) tipo de cuestionario fuera de la lista', '23514', insCuest, [dueno, doc, 'ensayo']);
      const insPreg = `INSERT INTO preguntas_cuestionario (cuestionario_id, usuario_id, orden, tipo, enunciado, opciones, correcta, correctas, verdadero, respuesta_texto, explicacion, cita_textual)
                       VALUES ($1, $2, $3, $4, '¿?', $5::jsonb, $6, $7::smallint[], $8, $9, 'x', 'una cita literal del texto') RETURNING id`;
      const op = JSON.stringify(['a', 'b', 'c', 'd']);
      const preg = async (orden, tipo, opciones, correcta, correctas, verdadero, texto) =>
        (await c.query(insPreg, [cuest, dueno, orden, tipo, opciones, correcta, correctas, verdadero, texto])).rows[0].id;
      const pUnica = await preg(1, 'unica', op, 1, null, null, null);
      const pMultiple = await preg(2, 'multiple', op, null, [0, 2], null, null);
      const pVf = await preg(3, 'vf', null, null, null, false, null);
      const pCompletar = await preg(4, 'completar', null, null, null, null, 'fotosíntesis');
      const pAbierta = await preg(5, 'abierta', null, null, null, null, 'Una respuesta modelo de más de veinte caracteres.');
      marcar(true, 'bs) una pregunta válida de cada tipo');
      const malas = [
        ['bt) múltiple con una sola correcta', 'multiple', op, null, [1], null, null],
        ['bu) múltiple con una correcta repetida', 'multiple', op, null, [1, 1], null, null],
        ['bv) múltiple con 4 correctas', 'multiple', op, null, [0, 1, 2, 3], null, null],
        ['bw) múltiple con una posición fuera de 0 a 3', 'multiple', op, null, [1, 4], null, null],
        ['bx) verdadero o falso sin verdadero', 'vf', null, null, null, null, null],
        ['by) completar con más de 40 caracteres', 'completar', null, null, null, null, 'x'.repeat(41)],
        ['bz) abierta con una respuesta modelo de menos de 20', 'abierta', null, null, null, null, 'corta'],
        ['ca) única con correctas de múltiple', 'unica', op, 1, [0, 1], null, null],
        ['cb) tipo de pregunta fuera de la lista', 'ensayo', null, null, null, null, 'x'],
      ];
      for (const [nombre, ...v] of malas) await esperaFalla(nombre, '23514', insPreg, [cuest, dueno, 9, ...v]);
      const intento = (await c.query('INSERT INTO intentos_cuestionario (cuestionario_id, usuario_id, preguntas, total) VALUES ($1, $2, $3::uuid[], 5) RETURNING id', [
        cuest,
        dueno,
        [pUnica, pMultiple, pVf, pCompletar, pAbierta],
      ])).rows[0].id;
      const insResp = 'INSERT INTO respuestas_intento (intento_id, pregunta_id, usuario_id, elegida, elegidas, texto, autoevaluacion, puntos, acierto) VALUES ($1, $2, $3, $4, $5::smallint[], $6, $7, $8, $9)';
      await c.query(insResp, [intento, pUnica, dueno, 1, null, null, null, 100, true]);
      await c.query(insResp, [intento, pMultiple, dueno, null, [0, 1, 2], null, null, 50, false]);
      await c.query(insResp, [intento, pVf, dueno, 0, null, null, null, 100, true]);
      await c.query(insResp, [intento, pCompletar, dueno, null, null, 'FOTOSINTESIS', null, 100, true]);
      await c.query(insResp, [intento, pAbierta, dueno, null, null, 'Mi respuesta.', null, null, null]);
      marcar(true, 'cc) respuestas de cada tipo, la abierta sin calificar (puntos y acierto en NULL)');
      await c.query("UPDATE respuestas_intento SET autoevaluacion = 'medias', puntos = 50, acierto = false WHERE intento_id = $1 AND pregunta_id = $2", [intento, pAbierta]);
      marcar(true, 'cd) la abierta calificada "A medias" vale 50');
      const otraPreg = await preg(6, 'unica', op, 0, null, null, null);
      const intento2 = (await c.query('INSERT INTO intentos_cuestionario (cuestionario_id, usuario_id, preguntas, total) VALUES ($1, $2, ARRAY[$3::uuid], 1) RETURNING id', [cuest, dueno, otraPreg])).rows[0].id;
      await esperaFalla('ce) 100 puntos sin acierto', '23514', insResp, [intento2, otraPreg, dueno, 0, null, null, null, 100, false]);
      await esperaFalla('cf) puntos sin acierto anotado', '23514', insResp, [intento2, otraPreg, dueno, 0, null, null, null, 50, null]);
      await esperaFalla('cg) puntos fuera de 0 a 100', '23514', insResp, [intento2, otraPreg, dueno, 0, null, null, null, 150, false]);
      await esperaFalla('ch) "A medias" con 100 puntos', '23514', insResp, [intento2, otraPreg, dueno, null, null, 'x', 'medias', 100, true]);
      await esperaFalla('ci) texto de más de 1000 caracteres', '23514', insResp, [intento2, otraPreg, dueno, null, null, 'x'.repeat(1001), null, 0, false]);
      await esperaFalla('cj) marcadas fuera de 0 a 3', '23514', insResp, [intento2, otraPreg, dueno, null, [5], null, null, 0, false]);
      await esperaFalla('ck) respuesta sin nada respondido', '23514', insResp, [intento2, otraPreg, dueno, null, null, null, null, 0, false]);
    } catch (e) {
      marcar(false, `bq-ck) tipos de pregunta: ${e.message}`);
    }
  }
  // M8 (ampliación, E12): Semestre (6.4, RB-05, RB-06, RB-09, RB-10).
  console.log('== 6m. Semestre (M8)');
  const TABLAS_SEMESTRE = ['materias', 'cortes', 'componentes', 'notas'];
  const rlsSemestre = await c.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY($1) AND relkind = 'r'", [TABLAS_SEMESTRE]);
  for (const t of TABLAS_SEMESTRE) {
    const fila = rlsSemestre.rows.find((r) => r.relname === t);
    marcar(Boolean(fila), `tabla ${t}`);
    marcar(fila?.relrowsecurity === true, `RLS activo en ${t}`);
  }
  const columnaMateria = await c.query("SELECT is_nullable FROM information_schema.columns WHERE table_name = 'documentos' AND column_name = 'materia_id'");
  marcar(columnaMateria.rows[0]?.is_nullable === 'YES', 'columna documentos.materia_id (opcional)');
  if (rlsSemestre.rowCount === 4 && dueno) {
    try {
      const insMateria = 'INSERT INTO materias (usuario_id, nombre, creditos) VALUES ($1, $2, $3) RETURNING id, usa_cortes';
      const materia = (await c.query(insMateria, [dueno, 'Verificar Cálculo', 3])).rows[0];
      marcar(materia.usa_cortes === false, 'cl) una materia nace sin cortes');
      await esperaFalla('cm) nombre de materia repetido sin distinguir mayúsculas (RB-05)', '23505', insMateria, [dueno, 'verificar cálculo', 2]);
      await esperaFalla('cn) créditos fuera de 1 a 10 (RB-06)', '23514', insMateria, [dueno, 'Otra', 11]);
      const otro = '00000000-0000-4000-8000-000000000000';
      const insCorte = 'INSERT INTO cortes (materia_id, usuario_id, orden, nombre, porcentaje) VALUES ($1, $2, $3, $4, $5) RETURNING id';
      const corte = (await c.query(insCorte, [materia.id, dueno, 1, 'Corte único', 10000])).rows[0].id;
      await esperaFalla('co) corte con porcentaje 0', '23514', insCorte, [materia.id, dueno, 2, 'Corte 2', 0]);
      await esperaFalla('cp) corte de una materia de otro usuario', '23503', insCorte, [materia.id, otro, 2, 'Corte 2', 3000]);
      await esperaFalla('cq) orden de corte repetido', '23505', insCorte, [materia.id, dueno, 1, 'Corte 1', 3000]);
      const insComp = 'INSERT INTO componentes (corte_id, usuario_id, orden, nombre, porcentaje) VALUES ($1, $2, $3, $4, $5) RETURNING id';
      const comp = (await c.query(insComp, [corte, dueno, 1, 'Parcial', 4000])).rows[0].id;
      await esperaFalla('cr) componente con nombre repetido en el corte', '23505', insComp, [corte, dueno, 2, 'PARCIAL', 2000]);
      await esperaFalla('cs) componente de más de 100 % (RB-10)', '23514', insComp, [corte, dueno, 2, 'Talleres', 10001]);
      await c.query(insComp, [corte, dueno, 2, 'Talleres', 9000]);
      marcar(true, 'ct) componentes que suman más de 100 % se guardan (RB-08 es un aviso)');
      const insNota = 'INSERT INTO notas (componente_id, usuario_id, orden, nota) VALUES ($1, $2, $3, $4)';
      await c.query(insNota, [comp, dueno, 1, 375]);
      await c.query(insNota, [comp, dueno, 2, null]);
      marcar(true, 'cu) nota 3,75 y una "sin nota"');
      await esperaFalla('cv) nota 5,5 (RB-09)', '23514', insNota, [comp, dueno, 3, 550]);
      await esperaFalla('cw) nota de otro usuario', '23503', insNota, [comp, otro, 3, 300]);
      const doc = (await c.query("INSERT INTO documentos (nombre_archivo, fecha_guardado, usuario_id, materia_id) VALUES ('materia.pdf', $1, $2, $3) RETURNING id", [hoy, dueno, materia.id])).rows[0].id;
      // La llave es (materia_id, usuario_id): una materia de otro dueño tampoco coincide.
      await esperaFalla('cx) documento con una materia que no es suya', '23503', "INSERT INTO documentos (nombre_archivo, fecha_guardado, usuario_id, materia_id) VALUES ('x.pdf', $1, $2, $3)", [hoy, dueno, otro]);
      await c.query('DELETE FROM materias WHERE id = $1', [materia.id]);
      const tras = await c.query(
        'SELECT (SELECT count(*) FROM cortes WHERE materia_id = $1)::int + (SELECT count(*) FROM componentes WHERE corte_id = $2)::int + (SELECT count(*) FROM notas WHERE componente_id = $3)::int AS n, (SELECT row(materia_id, usuario_id)::text FROM documentos WHERE id = $4) AS doc',
        [materia.id, corte, comp, doc],
      );
      marcar(tras.rows[0].n === 0 && tras.rows[0].doc === `(,${dueno})`, 'cy) al borrar la materia se borran sus cortes, componentes y notas; el documento queda sin materia y con su dueño');
    } catch (e) {
      marcar(false, `cl-cy) semestre: ${e.message}`);
    }
  }
  // M9 (ampliación, E14): fallas (6.5, RB-15).
  console.log('== 6n. Fallas (M9)');
  const columnasM9 = await c.query(
    "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'materias' AND column_name IN ('fallas_limite', 'fallas_registradas') ORDER BY column_name",
  );
  marcar(
    columnasM9.rowCount === 2 && columnasM9.rows[0].is_nullable === 'YES' && columnasM9.rows[1].is_nullable === 'NO' && String(columnasM9.rows[1].column_default) === '0',
    'columnas materias.fallas_limite (opcional) y fallas_registradas (0 por defecto)',
  );
  if (columnasM9.rowCount === 2 && dueno) {
    try {
      const m = (await c.query("INSERT INTO materias (usuario_id, nombre, creditos) VALUES ($1, 'Verificar fallas', 2) RETURNING id, fallas_limite, fallas_registradas", [dueno])).rows[0];
      marcar(m.fallas_limite === null && m.fallas_registradas === 0, 'cz) una materia nace sin límite y con 0 fallas');
      await esperaFalla('da) límite negativo (RB-15)', '23514', 'UPDATE materias SET fallas_limite = -1 WHERE id = $1', [m.id]);
      await esperaFalla('db) fallas registradas negativas (RB-15)', '23514', 'UPDATE materias SET fallas_registradas = -1 WHERE id = $1', [m.id]);
      await c.query('UPDATE materias SET fallas_limite = 0, fallas_registradas = 8 WHERE id = $1', [m.id]);
      marcar(true, 'dc) límite 0 y más fallas que el límite se guardan (la regla 7.7 decide)');
    } catch (e) {
      marcar(false, `cz-dc) fallas: ${e.message}`);
    }
  }

  console.log('== 6o. Metas semanales (M10)');
  const tablaM10 = await c.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'metas_semanales' AND relnamespace = 'public'::regnamespace");
  marcar(tablaM10.rows[0]?.relrowsecurity === true, 'tabla metas_semanales con RLS');
  if (tablaM10.rowCount === 1 && dueno) {
    try {
      const ins = 'INSERT INTO metas_semanales (usuario_id, tipo, categoria, objetivo) VALUES ($1, $2, $3, $4)';
      await c.query(ins, [dueno, 'tareas', null, 5]);
      await c.query(ins, [dueno, 'minutos', 'Verificar Metas', 180]);
      marcar(true, 'dd) una meta global de tareas y una de tiempo por categoría');
      await esperaFalla('de) objetivo 0 (RB-16)', '23514', ins, [dueno, 'tareas', 'Otra', 0]);
      await esperaFalla('df) tipo desconocido', '23514', ins, [dueno, 'horas', null, 3]);
      await esperaFalla('dg) categoría con espacios al borde', '23514', ins, [dueno, 'tareas', ' Otra ', 3]);
      await esperaFalla('dh) misma meta global repetida (RB-17)', '23505', ins, [dueno, 'tareas', null, 9]);
      await esperaFalla('di) misma categoría con otras mayúsculas (RB-17)', '23505', ins, [dueno, 'minutos', 'VERIFICAR METAS', 60]);
      await c.query(ins, [dueno, 'tareas', 'Verificar Metas', 2]);
      marcar(true, 'dj) la misma categoría con el otro tipo se guarda');
    } catch (e) {
      marcar(false, `dd-dj) metas: ${e.message}`);
    }
  }

  console.log('== 6p. Metas de nota (M11)');
  const tablaM11 = await c.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'metas_nota' AND relnamespace = 'public'::regnamespace");
  marcar(tablaM11.rows[0]?.relrowsecurity === true, 'tabla metas_nota con RLS');
  if (tablaM11.rowCount === 1 && dueno) {
    try {
      const mat = (await c.query("INSERT INTO materias (usuario_id, nombre, creditos, usa_cortes) VALUES ($1, 'Verificar metas nota', 3, true) RETURNING id", [dueno])).rows[0].id;
      const otra = (await c.query("INSERT INTO materias (usuario_id, nombre, creditos) VALUES ($1, 'Verificar metas otra', 2) RETURNING id", [dueno])).rows[0].id;
      const corte = (await c.query("INSERT INTO cortes (materia_id, usuario_id, orden, nombre, porcentaje) VALUES ($1, $2, 1, 'Corte 1', 3000) RETURNING id", [mat, dueno])).rows[0].id;
      const ins = 'INSERT INTO metas_nota (usuario_id, materia_id, corte_id, meta) VALUES ($1, $2, $3, $4)';
      await c.query(ins, [dueno, mat, null, 400]);
      await c.query(ins, [dueno, mat, corte, 450]);
      marcar(true, 'dk) una meta de la materia y una de su corte');
      await esperaFalla('dl) meta 0,0 (RB-18)', '23514', ins, [dueno, otra, null, 0]);
      await esperaFalla('dm) meta 5,1 (RB-18)', '23514', ins, [dueno, otra, null, 510]);
      await esperaFalla('dn) segunda meta de la misma materia (NULLS NOT DISTINCT)', '23505', ins, [dueno, mat, null, 300]);
      await esperaFalla('do) segunda meta del mismo corte', '23505', ins, [dueno, mat, corte, 300]);
      await esperaFalla('dp) un corte de otra materia', '23503', ins, [dueno, otra, corte, 300]);
      await c.query('DELETE FROM cortes WHERE id = $1', [corte]);
      const quedan = (await c.query('SELECT corte_id FROM metas_nota WHERE materia_id = $1', [mat])).rows;
      marcar(quedan.length === 1 && quedan[0].corte_id === null, 'dq) al borrar el corte se borra su meta; la de la materia queda');
      await c.query('DELETE FROM materias WHERE id = $1', [mat]);
      marcar((await c.query('SELECT 1 FROM metas_nota WHERE materia_id = $1', [mat])).rowCount === 0, 'dr) al borrar la materia se borran sus metas');
    } catch (e) {
      marcar(false, `dk-dr) metas de nota: ${e.message}`);
    }
  }

  console.log('== 6q. Temas (M12)');
  const tablaM12 = await c.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'temas' AND relnamespace = 'public'::regnamespace");
  marcar(tablaM12.rows[0]?.relrowsecurity === true, 'tabla temas con RLS');
  if (tablaM12.rowCount === 1 && dueno) {
    try {
      const mat = (await c.query("INSERT INTO materias (usuario_id, nombre, creditos) VALUES ($1, 'Verificar temas', 3) RETURNING id", [dueno])).rows[0].id;
      const corte = (await c.query("INSERT INTO cortes (materia_id, usuario_id, orden, nombre, porcentaje) VALUES ($1, $2, 1, 'Corte único', 10000) RETURNING id", [mat, dueno])).rows[0].id;
      const ins = 'INSERT INTO temas (usuario_id, corte_id, nombre, origen, estado, fuente) VALUES ($1, $2, $3, $4, $5, $6)';
      await c.query(ins, [dueno, corte, 'Derivadas', 'manual', 'confirmado', null]);
      await c.query(ins, [dueno, corte, 'Integrales', 'asistente', 'propuesto', 'syllabus.pdf · p. 2']);
      marcar(true, 'ds) un tema manual confirmado y uno propuesto con su fuente');
      await esperaFalla('dt) el mismo tema con otras mayúsculas', '23505', ins, [dueno, corte, 'DERIVADAS', 'manual', 'confirmado', null]);
      await esperaFalla('du) manual propuesto', '23514', ins, [dueno, corte, 'Límites', 'manual', 'propuesto', null]);
      await esperaFalla('dv) del asistente sin fuente', '23514', ins, [dueno, corte, 'Series', 'asistente', 'propuesto', null]);
      await esperaFalla('dw) nombre con espacios al borde', '23514', ins, [dueno, corte, ' Series ', 'manual', 'confirmado', null]);
      await esperaFalla('dx) estado fuera de la lista', '23514', ins, [dueno, corte, 'Series', 'asistente', 'otro', 'x']);
      await c.query('DELETE FROM materias WHERE id = $1', [mat]);
      marcar((await c.query('SELECT 1 FROM temas WHERE corte_id = $1', [corte])).rowCount === 0, 'dy) al borrar la materia se borran sus temas');
    } catch (e) {
      marcar(false, `ds-dy) temas: ${e.message}`);
    }
  }

  console.log('== 6r. Plan de estudio (M13)');
  const tablasM13 = await c.query(
    "SELECT relname FROM pg_class WHERE relname IN ('planes_estudio', 'versiones_plan', 'pasos_en_tareas') AND relnamespace = 'public'::regnamespace AND relrowsecurity",
  );
  marcar(tablasM13.rowCount === 3, 'tablas planes_estudio, versiones_plan y pasos_en_tareas con RLS');
  if (tablasM13.rowCount === 3 && dueno) {
    try {
      const mat = (await c.query("INSERT INTO materias (usuario_id, nombre, creditos) VALUES ($1, 'Verificar plan', 3) RETURNING id", [dueno])).rows[0].id;
      const corte = (await c.query("INSERT INTO cortes (materia_id, usuario_id, orden, nombre, porcentaje) VALUES ($1, $2, 1, 'Corte único', 10000) RETURNING id", [mat, dueno])).rows[0].id;
      const plan = (await c.query('INSERT INTO planes_estudio (usuario_id, corte_id) VALUES ($1, $2) RETURNING id', [dueno, corte])).rows[0].id;
      const ins = 'INSERT INTO versiones_plan (plan_id, usuario_id, numero, origen, contenido, huella) VALUES ($1, $2, $3, $4, $5, $6)';
      await c.query(ins, [plan, dueno, 1, 'asistente', { semanas: [] }, {}]);
      await c.query(ins, [plan, dueno, 2, 'manual', { semanas: [] }, {}]);
      marcar(true, 'dz) un plan con dos versiones');
      await esperaFalla('ea) un segundo plan para el mismo corte', '23505', 'INSERT INTO planes_estudio (usuario_id, corte_id) VALUES ($1, $2)', [dueno, corte]);
      await esperaFalla('eb) el mismo número de versión', '23505', ins, [plan, dueno, 2, 'manual', { semanas: [] }, {}]);
      await esperaFalla('ec) origen fuera de la lista', '23514', ins, [plan, dueno, 3, 'otro', { semanas: [] }, {}]);
      await esperaFalla('ed) contenido sin semanas', '23514', ins, [plan, dueno, 3, 'manual', { dias: [] }, {}]);
      await esperaFalla('ee) número 0', '23514', ins, [plan, dueno, 0, 'manual', { semanas: [] }, {}]);
      const tarea = (await c.query("INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion, prioridad, usuario_id) VALUES ('Verificar paso', CURRENT_DATE, CURRENT_DATE, 2, $1) RETURNING id", [dueno])).rows[0].id;
      const paso = '00000000-0000-4000-8000-000000000001';
      await c.query('INSERT INTO pasos_en_tareas (plan_id, paso_id, tarea_id, usuario_id) VALUES ($1, $2, $3, $4)', [plan, paso, tarea, dueno]);
      await esperaFalla('ef) el mismo paso dos veces en Tareas', '23505', 'INSERT INTO pasos_en_tareas (plan_id, paso_id, tarea_id, usuario_id) VALUES ($1, $2, $3, $4)', [plan, paso, tarea, dueno]);
      await c.query('DELETE FROM tareas_personales WHERE id = $1', [tarea]);
      marcar((await c.query('SELECT 1 FROM pasos_en_tareas WHERE plan_id = $1', [plan])).rowCount === 0, 'eg) al borrar la tarea se borra su marca');
      await c.query('DELETE FROM materias WHERE id = $1', [mat]);
      const quedan = (await c.query('SELECT (SELECT count(*) FROM planes_estudio WHERE id = $1) + (SELECT count(*) FROM versiones_plan WHERE plan_id = $1) AS n', [plan])).rows[0].n;
      marcar(Number(quedan) === 0, 'eh) al borrar la materia se borran el plan y sus versiones');
    } catch (e) {
      marcar(false, `dz-eh) plan de estudio: ${e.message}`);
    }
  }

  console.log('== 6s. Clave de Gemini y uso por cuenta (M24, E20c-1)');
  const tablasM24 = await c.query(
    "SELECT relname FROM pg_class WHERE relname IN ('claves_gemini', 'uso_ia_diario') AND relnamespace = 'public'::regnamespace AND relrowsecurity",
  );
  marcar(tablasM24.rowCount === 2, 'tablas claves_gemini y uso_ia_diario con RLS');
  const politicasM24 = await c.query("SELECT 1 FROM pg_policies WHERE tablename IN ('claves_gemini', 'uso_ia_diario')");
  marcar(politicasM24.rowCount === 0, 'sin políticas: solo el servidor las lee');
  if (tablasM24.rowCount === 2 && dueno) {
    try {
      const ins = 'INSERT INTO claves_gemini (usuario_id, cifrada, iv, etiqueta, version_llave, ultimos4, estado) VALUES ($1, $2, $3, $4, $5, $6, $7)';
      const bytes = (n) => Buffer.alloc(n, 7);
      await esperaFalla('ei) IV que no mide 12 bytes', '23514', ins, [dueno, bytes(39), bytes(11), bytes(16), 1, 'abcd', 'activa']);
      await esperaFalla('ej) etiqueta que no mide 16 bytes', '23514', ins, [dueno, bytes(39), bytes(12), bytes(15), 1, 'abcd', 'activa']);
      await esperaFalla('ek) estado fuera de la lista', '23514', ins, [dueno, bytes(39), bytes(12), bytes(16), 1, 'abcd', 'robada']);
      await esperaFalla('el) versión de llave 0', '23514', ins, [dueno, bytes(39), bytes(12), bytes(16), 0, 'abcd', 'activa']);
      await esperaFalla('em) usuario que no existe', '23503', ins, ['00000000-0000-4000-8000-0000000000ff', bytes(39), bytes(12), bytes(16), 1, 'abcd', 'activa']);
      await c.query('SAVEPOINT m24');
      await c.query(ins, [dueno, bytes(39), bytes(12), bytes(16), 1, 'abcd', 'ilegible']);
      await esperaFalla('en) una segunda clave para la misma cuenta', '23505', ins, [dueno, bytes(39), bytes(12), bytes(16), 1, 'abcd', 'activa']);
      await c.query('ROLLBACK TO SAVEPOINT m24');
      marcar(true, 'eo) una clave cifrada con estado ilegible se guarda');
      await esperaFalla('ep) consultas negativas', '23514', "INSERT INTO uso_ia_diario (usuario_id, dia, consultas) VALUES ($1, '2026-11-25', -1)", [dueno]);
    } catch (e) {
      marcar(false, `ei-ep) clave de Gemini: ${e.message}`);
    }
  }

  console.log('== 6t. Cuentas, niveles y administración (M25, E20c-2)');
  const tablasM25 = await c.query(
    "SELECT relname FROM pg_class WHERE relname IN ('cuentas', 'administracion', 'acciones_admin') AND relnamespace = 'public'::regnamespace AND relrowsecurity",
  );
  marcar(tablasM25.rowCount === 3, 'tablas cuentas, administracion y acciones_admin con RLS');
  marcar((await c.query("SELECT 1 FROM pg_policies WHERE tablename IN ('cuentas', 'administracion', 'acciones_admin')")).rowCount === 0, 'sin políticas: solo el servidor las lee');
  if (tablasM25.rowCount === 3 && dueno) {
    try {
      const sinFila = (await c.query('SELECT count(*)::int AS n FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM cuentas c WHERE c.usuario_id = u.id)')).rows[0].n;
      marcar(sinFila === 0, `eq) toda cuenta de Auth tiene su fila en cuentas (${sinFila} sin fila)`);
      const duenos = (await c.query("SELECT usuario_id FROM cuentas WHERE nivel = 'dueno'")).rows;
      marcar(duenos.length === 1 && duenos[0].usuario_id === dueno, 'er) un solo dueño: la cuenta del correo incorporado');
      await esperaFalla('et) bloquear al dueño', 'P0001', "UPDATE cuentas SET estado = 'bloqueada', bloqueada_en = now() WHERE usuario_id = $1", [dueno]);
      await esperaFalla('eu) bajarle el nivel al dueño', 'P0001', "UPDATE cuentas SET nivel = 'admin' WHERE usuario_id = $1", [dueno]);
      await esperaFalla('ev) borrar la fila del dueño', 'P0001', 'DELETE FROM cuentas WHERE usuario_id = $1', [dueno]);
      await c.query('SAVEPOINT m25');
      const nueva = (await c.query(
        "INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, created_at, updated_at) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verificar-m25@example.com', '{\"provider\":\"email\"}', now(), now()) RETURNING id",
      )).rows[0].id;
      const fila = (await c.query('SELECT estado, nivel FROM cuentas WHERE usuario_id = $1', [nueva])).rows[0];
      marcar(fila?.estado === 'pendiente' && fila?.nivel === 'usuario', 'ew) una cuenta nueva con correo nace pendiente (RB-92)');
      await esperaFalla('ex) hacer dueña a otra cuenta', 'P0001', "UPDATE cuentas SET nivel = 'dueno' WHERE usuario_id = $1", [nueva]);
      await esperaFalla('es) estado fuera de la lista', '23514', "UPDATE cuentas SET estado = 'borrada' WHERE usuario_id = $1", [nueva]);
      await esperaFalla('ey) bloqueada sin fecha', '23514', "UPDATE cuentas SET estado = 'bloqueada' WHERE usuario_id = $1", [nueva]);
      await c.query('DELETE FROM auth.users WHERE id = $1', [nueva]);
      marcar((await c.query('SELECT 1 FROM cuentas WHERE usuario_id = $1', [nueva])).rowCount === 0, 'ez) al borrar la cuenta de Auth se borra su fila');
      await c.query('ROLLBACK TO SAVEPOINT m25');
      await esperaFalla('fa) una segunda fila de administracion', '23514', 'INSERT INTO administracion (id) VALUES (2)');
      await esperaFalla('fb) tope de cuentas fuera de rango', '23514', 'UPDATE administracion SET tope_cuentas = 0 WHERE id = 1');
      await esperaFalla('fc) tope de espacio fuera de rango', '23514', 'UPDATE administracion SET tope_espacio_mb = 501 WHERE id = 1');
      await esperaFalla('fd) acción fuera de la lista', '23514', "INSERT INTO acciones_admin (admin_id, accion, correo) VALUES ($1, 'espiar', 'x@x.com')", [dueno]);
      await esperaFalla('fe) cambio de topes con correo', '23514', "INSERT INTO acciones_admin (admin_id, accion, correo) VALUES ($1, 'topes', 'x@x.com')", [dueno]);
      const espacio = (await c.query('SELECT bytes FROM nova_espacio($1)', [dueno])).rows[0];
      marcar(Number(espacio?.bytes ?? 0) > 0, `ff) nova_espacio estima el espacio del dueño (${espacio?.bytes ?? 0} bytes)`);
      const publicas = (await c.query(
        "SELECT p.proname FROM pg_proc p WHERE p.proname IN ('nova_espacio', 'nova_limpiar_registros', 'nova_antes_de_crear_usuario', 'nova_cuenta_nueva') AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))",
      )).rows.map((r) => r.proname);
      marcar(publicas.length === 0, `fg) las funciones de M25 no se pueden llamar desde la API pública (${publicas.join(', ') || 'ninguna'})`);
      marcar((await c.query("SELECT 1 FROM cron.job WHERE jobname = 'nova-limpieza' AND schedule = '0 8 * * *'")).rowCount === 1, 'fh) la limpieza diaria está programada (3:00 a. m. de Bogotá)');
      await c.query('SAVEPOINT tope');
      await c.query("UPDATE administracion SET tope_cuentas = (SELECT greatest(1, count(*)) FROM cuentas WHERE nivel = 'usuario') WHERE id = 1");
      const gancho = (await c.query("SELECT public.nova_antes_de_crear_usuario('{\"user\":{\"email\":\"alguien@example.com\"}}') AS r")).rows[0].r;
      const ganchoDueno = (await c.query("SELECT public.nova_antes_de_crear_usuario('{\"user\":{\"email\":\"juandelarosa1617@gmail.com\"}}') AS r")).rows[0].r;
      marcar(gancho?.error?.http_code === 403 && Object.keys(ganchoDueno ?? {}).length === 0, 'fi) con el tope alcanzado el gancho rechaza la cuenta nueva (RB-81)');
      await c.query('ROLLBACK TO SAVEPOINT tope');
    } catch (e) {
      marcar(false, `eq-fi) cuentas: ${e.message}`);
    }
  }

  console.log('== 6u. Tipos de documento (M26, E20d)');
  const columnasM26 = await c.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND (table_name, column_name) IN (('documentos', 'tipo'), ('documentos', 'unidad'), ('fragmentos_pdf', 'ocr'), ('capitulos', 'tipo'))",
  );
  marcar(columnasM26.rowCount === 4, 'columnas documentos.tipo y unidad, fragmentos_pdf.ocr y capitulos.tipo');
  if (columnasM26.rowCount === 4 && dueno) {
    try {
      const viejos = (await c.query("SELECT count(*)::int AS n FROM documentos WHERE unidad = 'pagina' AND tipo NOT IN ('pdf', 'pdf_escaneado', 'imagen')")).rows[0].n;
      marcar(viejos === 0, `fj) solo los PDF y las fotos van por páginas (${viejos} de otro tipo por páginas)`);
      await c.query('SAVEPOINT m26');
      // Como lo crea el código de master: sin tipo ni unidad, queda como un PDF por páginas.
      const doc = (await c.query("INSERT INTO documentos (nombre_archivo, categoria, num_fragmentos, fecha_guardado, usuario_id) VALUES ('verificar-m26.pdf', 'General', 0, '2026-11-26', $1) RETURNING id, tipo, unidad", [dueno])).rows[0];
      marcar(doc.tipo === 'pdf' && doc.unidad === 'pagina', 'fk) un documento creado como en master queda PDF por páginas');
      await esperaFalla('fl) tipo fuera de la lista', '23514', "UPDATE documentos SET tipo = 'doc' WHERE id = $1", [doc.id]);
      await esperaFalla('fm) unidad fuera de la lista', '23514', "UPDATE documentos SET unidad = 'hoja' WHERE id = $1", [doc.id]);
      await esperaFalla('fn) grupo fuera de la lista', '23514', "INSERT INTO capitulos (documento_id, usuario_id, orden, titulo, pagina_inicio, pagina_fin, etiqueta_paginas, tipo) VALUES ($1, $2, 1, 'X', 1, 1, '1', 'tomo')", [doc.id, dueno]);
      await c.query('ROLLBACK TO SAVEPOINT m26');
    } catch (e) {
      marcar(false, `fj-fn) tipos de documento: ${e.message}`);
    }
  }
  console.log('== 6v. Registro de migraciones protegido (M28)');
  const m28 = await c.query("SELECT 1 FROM _migrations WHERE nombre = '20261128110000_nova_proteger_registro.sql'");
  if (m28.rowCount === 1) {
    const registro = await c.query(
      "SELECT relrowsecurity AS rls, has_table_privilege('anon', oid, 'SELECT, INSERT, UPDATE, DELETE') OR has_table_privilege('authenticated', oid, 'SELECT, INSERT, UPDATE, DELETE') AS publico FROM pg_class WHERE oid = to_regclass('public._migrations')",
    );
    marcar(registro.rows[0]?.rls === true && registro.rows[0]?.publico === false, 'M28: _migrations con RLS y sin permisos para la API pública');
  } else {
    console.log('     pendiente: M28 sin aplicar');
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
