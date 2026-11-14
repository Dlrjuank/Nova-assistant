// E11e (S-76, 7.14): crear con el mismo idCliente contra la base real. Ejecutar: npm run probar:sin-conexion
// Usa dos usuarios temporales y los borra al final. Sin llamadas a Gemini.
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { crearTareaConResultado } from '@/lib/datos/tareas';
import { hoyBogota, sumarDias } from '@/lib/reglas/fechas';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();

let fallas = 0;
function marcar(ok: boolean, texto: string, detalle = ''): void {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}${detalle ? ` -> ${detalle}` : ''}`);
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error('Faltan las variables de Supabase.');
  const admin = createClient(url, clave, { auth: { persistSession: false } });
  const crearUsuario = async (n: number) => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `nova-prueba-sin-conexion-${n}-${Date.now()}@example.com`,
      password: `Prueba-${randomBytes(12).toString('hex')}`,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`No se pudo crear el usuario temporal: ${error?.message}`);
    return data.user.id;
  };
  const U = await crearUsuario(1);
  const V = await crearUsuario(2);
  const sql = new pg.Client(opcionesConexion(process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING as string));
  await sql.connect();
  const contar = async (q: string, v: unknown[]) => (await sql.query<{ n: number }>(q, v)).rows[0]?.n ?? -1;

  try {
    const manana = sumarDias(hoyBogota(), 1);
    const base = { titulo: 'Sin conexión (prueba)', fechaLimite: manana, horaInicio: '10:00', recordatorio: '1_hora' };

    // Un reintento después de un corte: la misma tarea.
    const id1 = randomUUID();
    const a = await crearTareaConResultado(U, { ...base, idCliente: id1 });
    const b = await crearTareaConResultado(U, { ...base, idCliente: id1 });
    marcar(!a.yaExistia && b.yaExistia && a.tarea.id === b.tarea.id, 'reintento con el mismo idCliente: devuelve la misma tarea (201 y luego 200)');

    // Dos pestañas (o más) a la vez, con una categoría nueva y un recordatorio.
    const id2 = randomUUID();
    const resultados = await Promise.all(
      Array.from({ length: 5 }, () => crearTareaConResultado(U, { ...base, titulo: 'A la vez (prueba)', categoria: 'Categoría nueva sin conexión', idCliente: id2 })),
    );
    const ids = new Set(resultados.map((r) => r.tarea.id));
    marcar(ids.size === 1 && resultados.filter((r) => !r.yaExistia).length === 1, 'cinco envíos a la vez: una sola tarea, una sola creada', `${resultados.filter((r) => !r.yaExistia).length} creada(s)`);
    marcar((await contar('SELECT count(*)::int AS n FROM tareas_personales WHERE usuario_id = $1 AND id_cliente = $2', [U, id2])) === 1, 'en la base hay una sola fila con ese idCliente');
    marcar(
      (await contar('SELECT count(*)::int AS n FROM categorias WHERE usuario_id = $1 AND lower(nombre) = lower($2)', [U, 'Categoría nueva sin conexión'])) === 1,
      'la categoría nueva se creó una sola vez',
    );
    const rec = (await sql.query<{ recordatorio: string; estado: string }>('SELECT recordatorio, recordatorio_estado AS estado FROM tareas_personales WHERE usuario_id = $1 AND id_cliente = $2', [U, id2])).rows;
    marcar(rec.length === 1 && rec[0]?.recordatorio === '1_hora' && rec[0]?.estado === 'pendiente', 'un solo recordatorio, pendiente');

    // Si borraron la categoría entre un envío y su reintento, el reintento no la vuelve a crear.
    const id3 = randomUUID();
    await crearTareaConResultado(U, { ...base, categoria: 'Se borrará', idCliente: id3 });
    await sql.query("UPDATE tareas_personales SET categoria = 'General' WHERE usuario_id = $1 AND categoria = 'Se borrará'", [U]);
    await sql.query("DELETE FROM categorias WHERE usuario_id = $1 AND nombre = 'Se borrará'", [U]);
    const reintento = await crearTareaConResultado(U, { ...base, categoria: 'Se borrará', idCliente: id3 });
    marcar(
      reintento.yaExistia && (await contar("SELECT count(*)::int AS n FROM categorias WHERE usuario_id = $1 AND nombre = 'Se borrará'", [U])) === 0,
      'el reintento no repite la categoría nueva',
    );

    // El mismo idCliente en otro usuario no choca.
    const otro = await crearTareaConResultado(V, { ...base, idCliente: id1 });
    marcar(!otro.yaExistia && otro.tarea.id !== a.tarea.id, 'el idCliente de otro usuario no choca');

    // Sin idCliente, todo sigue igual: dos envíos, dos tareas.
    const s1 = await crearTareaConResultado(U, { ...base, titulo: 'Sin idCliente (prueba)' });
    const s2 = await crearTareaConResultado(U, { ...base, titulo: 'Sin idCliente (prueba)' });
    marcar(s1.tarea.id !== s2.tarea.id && !s1.yaExistia && !s2.yaExistia, 'sin idCliente se crean dos tareas, como antes');

    // RB-73: el recordatorio lo calcula el servidor; si ya pasó, queda omitido.
    const pasada = await crearTareaConResultado(U, { titulo: 'Recordatorio pasado (prueba)', fechaLimite: sumarDias(hoyBogota(), -1), recordatorio: 'a_la_hora', idCliente: randomUUID() });
    marcar(pasada.tarea.recordatorioEstado === 'omitido', 'un recordatorio cuyo momento ya pasó llega omitido (RB-73)');

    // Un rechazo no deja nada a medias.
    try {
      await crearTareaConResultado(U, { ...base, categoria: 'x'.repeat(81), idCliente: randomUUID() });
      marcar(false, 'una categoría inválida se rechaza');
    } catch (e) {
      marcar(Boolean((e as { codigo?: string }).codigo), 'una categoría inválida se rechaza con su mensaje', (e as Error).message);
    }
  } finally {
    for (const u of [U, V]) {
      await sql.query('DELETE FROM tareas_personales WHERE usuario_id = $1', [u]);
      await sql.query('DELETE FROM categorias WHERE usuario_id = $1', [u]);
      await admin.auth.admin.deleteUser(u);
    }
    await sql.end();
    console.log('Usuarios temporales borrados');
  }
  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error('Error inesperado:', e instanceof Error ? e.message : e);
  process.exit(1);
});
