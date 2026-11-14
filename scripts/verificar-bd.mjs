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

  // M5 (ampliación, E01): dueño en tareas, documentos y fuentes web, sin romper el código de master.
  console.log('== 6b. Dueño por usuario (M5)');
  const conDueno = ['tareas_personales', 'documentos', 'fuentes_web'];
  const cols = await c.query(
    "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='usuario_id' AND table_name = ANY($1)",
    [conDueno],
  );
  for (const t of conDueno) marcar(cols.rows.some((r) => r.table_name === t), `columna usuario_id en ${t}`);
  // Sin M5 no se consulta nova_config: un error abortaría la transacción de las pruebas.
  const hayConfig = (await c.query("SELECT to_regclass('public.nova_config') AS r")).rows[0].r !== null;
  const dueno = hayConfig
    ? (await c.query("SELECT valor FROM nova_config WHERE clave='dueno_por_defecto'")).rows[0]?.valor
    : undefined;
  marcar(Boolean(dueno), 'nova_config.dueno_por_defecto');
  const rlsConfig = await c.query("SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.nova_config')");
  marcar(rlsConfig.rows[0]?.relrowsecurity === true, 'RLS activo en nova_config');
  const disp = await c.query(
    "SELECT tgname FROM pg_trigger WHERE tgname IN ('tareas_dueno_por_defecto','documentos_dueno_por_defecto','fuentes_dueno_por_defecto') AND NOT tgisinternal",
  );
  marcar(disp.rowCount === 3, `disparadores de dueño por defecto (${disp.rowCount} de 3; temporales, se quitan al unir con master)`);
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
      // k) Como master: INSERT sin usuario_id → el disparador pone el dueño por defecto.
      const docDueno = (await c.query('SELECT usuario_id FROM documentos WHERE id = $1', [docId])).rows[0]?.usuario_id;
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
      marcar(docDueno === dueno && tareaMaster === dueno && fuenteMaster === dueno, 'k) INSERT sin usuario_id (como master) queda con el dueño por defecto');

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
    const insHora = 'INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion, hora_inicio, hora_fin) VALUES ($1, $2, $2, $3, $4)';
    try {
      await c.query(insHora, ['Verificación horario', hoy, '08:00', '09:30']);
      await c.query(insHora, ['Verificación solo inicio', hoy, '08:00', null]);
      marcar(true, 'q) horario completo y solo inicio se aceptan');
    } catch (e) {
      marcar(false, `q) horario válido: ${e.message}`);
    }
    await esperaFalla('r) hora de fin sin inicio', '23514', insHora, ['Verificación', hoy, null, '09:30']);
    await esperaFalla('s) hora de fin antes del inicio', '23514', insHora, ['Verificación', hoy, '10:00', '09:30']);
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
