// E21: ensayo y reverso de M29 (el aviso de cada minuto llama solo si hay trabajo). M29 se APLICA con db:migrar
// (pasos en supabase/pendientes/README.md), no con este script.
//   node scripts/m29.mjs --ensayo                 aplica M29, prueba cada condición y su reverso en una transacción que
//                                                 SIEMPRE se revierte (ninguna llamada sale: pg_net solo envía lo confirmado)
//   node scripts/m29.mjs --revertir --confirmar   deshace una M29 ya aplicada
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

const NOMBRE = '20261128120000_nova_tick_solo_con_trabajo.sql';
const banderas = process.argv.slice(2);
const ensayo = banderas.includes('--ensayo');
const revertir = banderas.includes('--revertir') && banderas.includes('--confirmar');
if (ensayo === revertir) {
  console.error('Uso: node scripts/m29.mjs --ensayo | --revertir --confirmar');
  process.exit(1);
}

const leer = (...partes) => readFileSync(join(process.cwd(), 'supabase', ...partes), 'utf8');
const migracion = () => leer(existsSync(join(process.cwd(), 'supabase', 'migrations', NOMBRE)) ? 'migrations' : 'pendientes', NOMBRE);
const reverso = leer('reversos', 'M29_reverso.sql');

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
const hayTrabajo = async () => (await c.query('SELECT public.nova_hay_trabajo_tick() AS hay')).rows[0].hay;
const enCola = async () => Number((await c.query('SELECT count(*) AS n FROM net.http_request_queue')).rows[0].n);

/** Cada caso parte sin trabajo y se deshace al terminar. */
async function caso(texto, esperado, preparar) {
  await c.query('SAVEPOINT caso');
  try {
    await preparar();
    const hay = await hayTrabajo();
    marcar(hay === esperado, `${texto}: ${esperado ? 'hay trabajo' : 'no hay trabajo'}`);
  } finally {
    await c.query('ROLLBACK TO SAVEPOINT caso');
  }
}

async function ensayar() {
  await c.query(migracion());
  const dueno = (await c.query("SELECT usuario_id FROM cuentas WHERE nivel = 'dueno'")).rows[0].usuario_id;
  // Sin nada pendiente (todo se revierte al final).
  await c.query("UPDATE tareas_personales SET recordatorio_estado = 'omitido' WHERE recordatorio_estado = 'pendiente'");
  await c.query('UPDATE preferencias_usuario SET resumen_diario = false WHERE resumen_diario');
  await c.query('UPDATE cuentas SET debe_cambiar_contrasena = false WHERE debe_cambiar_contrasena');
  await c.query('UPDATE documentos SET progreso = NULL, por_indexar = NULL, indexando_hasta = NULL WHERE progreso IS NOT NULL OR por_indexar IS NOT NULL');
  marcar((await hayTrabajo()) === false, 'sin nada pendiente: no hay trabajo');
  const antes = await enCola();
  await c.query('SELECT public.nova_llamar_tick()');
  marcar((await enCola()) === antes, 'sin trabajo, nova_llamar_tick no llama');

  const tarea = (cuando, estado = 'Pendiente') =>
    c.query(
      `INSERT INTO tareas_personales (titulo, fecha_limite, fecha_creacion, usuario_id, estado, fecha_cierre, recordatorio, recordatorio_en, recordatorio_estado)
       VALUES ('ensayo M29', CURRENT_DATE, CURRENT_DATE, $1, $2::varchar, CASE WHEN $2::varchar = 'Completada' THEN CURRENT_DATE END, 'a_la_hora', now() + $3::interval, 'pendiente')`,
      [dueno, estado, cuando],
    );
  await caso('recordatorio que ya llegó', true, () => tarea('-1 minute'));
  await caso('recordatorio futuro', false, () => tarea('1 hour'));
  await caso('recordatorio pendiente de una tarea completada', true, () => tarea('1 hour', 'Completada'));

  const resumen = (hora) =>
    c.query(
      `INSERT INTO preferencias_usuario (usuario_id, resumen_diario, hora_resumen) VALUES ($1, true, $2)
       ON CONFLICT (usuario_id) DO UPDATE SET resumen_diario = true, hora_resumen = EXCLUDED.hora_resumen`,
      [dueno, hora],
    );
  const sinEnvioDeHoy = () => c.query("DELETE FROM envios WHERE usuario_id = $1 AND tipo = 'resumen' AND fecha = (now() AT TIME ZONE 'America/Bogota')::date", [dueno]);
  await caso('resumen cuya hora ya llegó', true, async () => {
    await sinEnvioDeHoy();
    await resumen('00:00');
  });
  await caso('resumen de más tarde', false, async () => {
    await sinEnvioDeHoy();
    await resumen('23:59:59');
  });
  await caso('resumen de hoy ya anotado', false, async () => {
    await sinEnvioDeHoy();
    await resumen('00:00');
    await c.query("INSERT INTO envios (usuario_id, tipo, fecha, resultado) VALUES ($1, 'resumen', (now() AT TIME ZONE 'America/Bogota')::date, 'ensayo')", [dueno]);
  });

  const temporal = (vence, usada = null) =>
    c.query('UPDATE cuentas SET debe_cambiar_contrasena = true, temporal_vence_en = now() + $2::interval, temporal_usada_en = $3 WHERE usuario_id = $1', [dueno, vence, usada]);
  await caso('contraseña temporal vencida', true, () => temporal('-1 minute'));
  await caso('contraseña temporal vigente', false, () => temporal('1 hour'));
  await caso('contraseña temporal ya usada', false, () => temporal('-1 minute', new Date()));

  const documento = (porIndexar, libre = null, progreso = 10, deQuien = dueno) =>
    c.query(
      `INSERT INTO documentos (nombre_archivo, categoria, num_fragmentos, fecha_guardado, usuario_id, paginas, tipo, unidad, progreso, por_indexar, indexando_hasta)
       VALUES ('ensayo-m29.pdf', 'General', 0, CURRENT_DATE, $1, 1, 'pdf', 'pagina', $2, $3::jsonb, now() + $4::interval)`,
      [deQuien, progreso, JSON.stringify(porIndexar), libre],
    );
  const hace = (ms) => new Date(Date.now() - ms).toISOString();
  await caso('libro a medias del dueño', true, () => documento([]));
  await caso('libro que otra llamada está indexando', false, () => documento([], '5 minutes'));
  // Una cuenta sin el nivel de dueño (la del dueño no se puede bloquear).
  const otra = (await c.query("SELECT usuario_id FROM cuentas WHERE nivel <> 'dueno' LIMIT 1")).rows[0]?.usuario_id;
  if (!otra) console.log('     sin segunda cuenta: los casos de otra persona no se probaron');
  else {
    const libroDeOtra = async (cambios) => {
      await c.query('DELETE FROM claves_gemini WHERE usuario_id = $1', [otra]);
      await c.query("UPDATE cuentas SET estado = $2::varchar, usa_clave_proyecto = $3, nivel = 'usuario', bloqueada_en = CASE WHEN $2::varchar = 'bloqueada' THEN now() END WHERE usuario_id = $1", [otra, cambios.estado, cambios.permiso]);
      await documento([], null, 10, otra);
    };
    await caso('libro de una persona activa con permiso de la clave del proyecto', true, () => libroDeOtra({ estado: 'activa', permiso: true }));
    await caso('libro de una persona sin clave ni permiso', false, () => libroDeOtra({ estado: 'activa', permiso: false }));
    await caso('libro de una cuenta bloqueada', false, () => libroDeOtra({ estado: 'bloqueada', permiso: true }));
  }
  await caso('pregunta del OCR sin vencer', false, () => documento({ estado: 'pregunta', venceEn: hace(-3600_000) }));
  await caso('pregunta del OCR vencida', true, () => documento({ estado: 'pregunta', venceEn: hace(60_000) }));
  await caso('lectura del OCR sin avanzar en 8 días', true, () => documento({ estado: 'leyendo', avanzoEn: hace(8 * 86_400_000) }));

  await c.query('SAVEPOINT caso');
  await tarea('-1 minute');
  const previas = await enCola();
  await c.query('SELECT public.nova_llamar_tick()');
  marcar((await enCola()) === previas + 1, 'con trabajo, nova_llamar_tick deja una llamada en la cola');
  await c.query('ROLLBACK TO SAVEPOINT caso');

  await c.query(reverso);
  marcar((await c.query("SELECT 1 FROM pg_proc WHERE proname = 'nova_hay_trabajo_tick'")).rowCount === 0, 'reverso: se quita la revisión');
  const sin = await enCola();
  await c.query('SELECT public.nova_llamar_tick()');
  marcar((await enCola()) === sin + 1, 'reverso: vuelve a llamar aunque no haya nada');
}

try {
  await c.connect();
  await c.query('BEGIN');
  // Si algo tiene tomadas las filas, mejor desistir que dejar esperando a la app.
  await c.query("SET LOCAL lock_timeout = '3s'");
  if (ensayo) {
    await ensayar();
    await c.query('ROLLBACK');
    marcar((await c.query("SELECT 1 FROM pg_proc WHERE proname = 'nova_hay_trabajo_tick'")).rowCount === 0, 'ensayo revertido: la base no cambió');
  } else {
    await c.query(reverso);
    await c.query('COMMIT');
    console.log(`Reverso aplicado. Mueve supabase/migrations/${NOMBRE} a supabase/pendientes/ para que db:migrar no la repita.`);
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
