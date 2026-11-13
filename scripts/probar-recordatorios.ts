// E11c y E11d: prueba los recordatorios y el resumen diario contra la base real (7.10, RB-43 a RB-46). Ejecutar: npm run probar:recordatorios
// Usa un usuario temporal; el procesamiento se limita a ese usuario (no toca los recordatorios de nadie más).
// No envía notificaciones de verdad: la suscripción de prueba apunta a una dirección local que rechaza la conexión,
// así que se comprueba qué se marca y cuántas veces, no la entrega. Sin llamadas a Gemini. Al final borra todo.
import { createECDH, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { actualizarConfiguracion } from '@/lib/datos/configuracion';
import { guardarSuscripcion, procesarRecordatorios, procesarResumenes } from '@/lib/datos/notificaciones';
import { completarTarea, crearTarea, editarTarea } from '@/lib/datos/tareas';
import { hoyBogota, sumarDias } from '@/lib/reglas/fechas';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();

let fallas = 0;
function marcar(ok: boolean, texto: string, detalle = ''): void {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}${detalle ? ` -> ${detalle}` : ''}`);
}

/** "HH:MM" de Bogotá dentro de `minutos`. */
function horaBogotaEn(minutos: number): { fecha: string; hora: string } {
  const d = new Date(Date.now() + minutos * 60_000);
  const partes = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  const [fecha, hora] = partes.split(' ');
  return { fecha: fecha as string, hora: hora as string };
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error('Faltan las variables de Supabase.');
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) throw new Error('Faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en .env.local.');
  const admin = createClient(url, clave, { auth: { persistSession: false } });
  const email = `nova-prueba-recordatorios-${Date.now()}@example.com`;
  const { data: creado, error } = await admin.auth.admin.createUser({ email, password: `Prueba-${randomBytes(12).toString('hex')}`, email_confirm: true });
  if (error || !creado.user) throw new Error(`No se pudo crear el usuario temporal: ${error?.message}`);
  const U = creado.user.id;
  const sql = new pg.Client(opcionesConexion(process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING as string));
  await sql.connect();
  const fila = async (id: string) =>
    (await sql.query<{ estado: string; en: Date | null; bogota: string | null }>(
      `SELECT recordatorio_estado AS estado, recordatorio_en AS en,
              to_char(recordatorio_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS bogota
       FROM tareas_personales WHERE id = $1`,
      [id],
    )).rows[0];
  const vencer = (id: string, minutos: number) =>
    sql.query(`UPDATE tareas_personales SET recordatorio_en = now() - make_interval(mins => $2) WHERE id = $1`, [id, minutos]);

  try {
    const hoy = hoyBogota();
    const pasado = sumarDias(hoy, 3);

    // 7.10 al crear.
    const en20 = horaBogotaEn(20);
    const clase = await crearTarea(U, { titulo: 'Clase (prueba recordatorios)', fechaLimite: en20.fecha, horaInicio: en20.hora, recordatorio: '15_min' });
    const r1 = await fila(clase.id);
    marcar(clase.recordatorio === '15_min' && r1?.estado === 'pendiente', 'crear con horario y "15 min antes": pendiente', r1?.bogota ?? '');
    marcar(Math.abs(new Date(r1?.en ?? 0).getTime() - (Date.now() + 5 * 60_000)) < 90_000, 'su momento es 15 min antes de la hora de inicio (≈ en 5 min)');

    const pagar = await crearTarea(U, { titulo: 'Pagar (prueba recordatorios)', fechaLimite: pasado, recordatorio: 'a_la_hora' });
    marcar((await fila(pagar.id))?.bogota === `${pasado} 08:00`, 'sin horario, "El mismo día" a la hora fija (8:00)');

    const vieja = await crearTarea(U, { titulo: 'Ya pasó (prueba recordatorios)', fechaLimite: sumarDias(hoy, -2), recordatorio: '1_dia' });
    marcar((await fila(vieja.id))?.estado === 'omitido', 'si el momento ya pasó al guardar, queda omitido (RB-43)');

    try {
      await crearTarea(U, { titulo: 'Sin hora', fechaLimite: pasado, recordatorio: '15_min' });
      marcar(false, '"15 min antes" sin horario se rechaza');
    } catch (e) {
      marcar((e as { codigo?: string }).codigo === 'RECORDATORIO_INVALIDO', '"15 min antes" sin horario se rechaza (RB-43)');
    }

    // Editar recalcula; quitar el recordatorio lo borra.
    await editarTarea(U, pagar.id, { titulo: 'Pagar (prueba recordatorios)', fechaLimite: pasado, horaInicio: '14:00', recordatorio: '1_hora' });
    marcar((await fila(pagar.id))?.bogota === `${pasado} 13:00`, 'editar recalcula: con horario 14:00 y "1 hora antes" → 13:00');
    await editarTarea(U, pagar.id, { titulo: 'Pagar (prueba recordatorios)', fechaLimite: pasado, recordatorio: '1_dia' });
    marcar((await fila(pagar.id))?.bogota === `${sumarDias(pasado, -1)} 08:00`, 'quitar el horario con "1 día antes" → el día anterior a las 8:00');

    // Cambiar la hora fija recalcula solo las tareas sin horario.
    const antesClase = (await fila(clase.id))?.bogota;
    await actualizarConfiguracion(U, email, { horaRecordatorio: '18:30' });
    marcar((await fila(pagar.id))?.bogota === `${sumarDias(pasado, -1)} 18:30`, 'al cambiar la hora fija a 18:30, la tarea sin horario se recalcula');
    marcar((await fila(clase.id))?.bogota === antesClase, 'la tarea con horario no cambia');

    // RB-45: sin ningún dispositivo con notificaciones, el recordatorio queda omitido.
    await vencer(clase.id, 1);
    const sinDispositivo = await procesarRecordatorios(new Date(), { soloUsuario: U });
    marcar(sinDispositivo.sinDispositivo === 1 && (await fila(clase.id))?.estado === 'omitido', 'sin dispositivos, el recordatorio vencido queda omitido (RB-45)', JSON.stringify(sinDispositivo));

    // Con un dispositivo: una sola vez, aunque dos avisos coincidan (S-48).
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    await guardarSuscripcion(U, { endpoint: 'https://127.0.0.1:9/nova-prueba', keys: { p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') }, dispositivo: 'Prueba' });
    const t1 = await crearTarea(U, { titulo: 'Avisa una vez (prueba recordatorios)', fechaLimite: pasado, horaInicio: '09:00', recordatorio: 'a_la_hora' });
    const t2 = await crearTarea(U, { titulo: 'Atrasada (prueba recordatorios)', fechaLimite: pasado, horaInicio: '09:00', recordatorio: 'a_la_hora' });
    const t3 = await crearTarea(U, { titulo: 'Completada (prueba recordatorios)', fechaLimite: pasado, horaInicio: '09:00', recordatorio: 'a_la_hora' });
    await vencer(t1.id, 2);
    await vencer(t2.id, 45);
    await vencer(t3.id, 2);
    await sql.query(`UPDATE tareas_personales SET estado = 'Completada', fecha_cierre = $2 WHERE id = $1`, [t3.id, hoy]); // como lo hace master
    const [a, b] = await Promise.all([procesarRecordatorios(new Date(), { soloUsuario: U }), procesarRecordatorios(new Date(), { soloUsuario: U })]);
    marcar(a.enviados + b.enviados === 1, 'dos avisos a la vez: la tarea se envía una sola vez (FOR UPDATE SKIP LOCKED)', `${a.enviados} + ${b.enviados}`);
    marcar((await fila(t1.id))?.estado === 'enviado', 'queda enviado');
    marcar((await fila(t2.id))?.estado === 'omitido', 'la atrasada más de 30 minutos queda omitida (7.10)');
    marcar((await fila(t3.id))?.estado === 'omitido', 'la completada desde master ya no avisa');
    const otra = await procesarRecordatorios(new Date(), { soloUsuario: U });
    marcar(otra.enviados === 0, 'el minuto siguiente no la vuelve a enviar');
    const envio = (await sql.query<{ resultado: string }>(`SELECT resultado FROM envios WHERE tarea_id = $1`, [t1.id])).rows;
    marcar(envio.length === 1, 'queda un registro del envío', envio[0]?.resultado ?? '');
    const sus = (await sql.query<{ ultimo_error: string | null }>('SELECT ultimo_error FROM suscripciones_push WHERE usuario_id = $1', [U])).rows[0];
    marcar(Boolean(sus?.ultimo_error), 'el dispositivo de prueba (que rechaza la conexión) queda con su error anotado');

    // E11d (RB-46): resumen diario. Hay una vencida ("Ya pasó") y un dispositivo de prueba.
    const resumenes = async () =>
      (await sql.query<{ resultado: string }>(`SELECT resultado FROM envios WHERE usuario_id = $1 AND tipo = 'resumen' ORDER BY creado_en`, [U])).rows;
    const apagado = await procesarResumenes(new Date(), { soloUsuario: U });
    marcar(apagado.enviados + apagado.sinTareas + apagado.omitidos === 0 && (await resumenes()).length === 0, 'con el resumen apagado (por defecto) no se hace nada');
    const hace2 = horaBogotaEn(-2);
    const hace45 = horaBogotaEn(-45);
    if (hace2.fecha !== hoyBogota() || hace45.fecha !== hoyBogota()) {
      console.log('(se omiten las pruebas del resumen: es casi medianoche en Bogotá)');
    } else {
      await actualizarConfiguracion(U, email, { resumenDiario: true, horaResumen: hace2.hora });
      const [r1, r2] = await Promise.all([procesarResumenes(new Date(), { soloUsuario: U }), procesarResumenes(new Date(), { soloUsuario: U })]);
      const filas = await resumenes();
      marcar(r1.enviados + r2.enviados === 1 && filas.length === 1, 'dos avisos a la vez: un solo resumen en el día', `${r1.enviados} + ${r2.enviados}, ${filas[0]?.resultado ?? ''}`);
      const r3 = await procesarResumenes(new Date(), { soloUsuario: U });
      marcar(r3.enviados === 0 && (await resumenes()).length === 1, 'el minuto siguiente no lo repite');
      await sql.query(`DELETE FROM envios WHERE usuario_id = $1 AND tipo = 'resumen'`, [U]);
      await actualizarConfiguracion(U, email, { horaResumen: hace45.hora });
      const r4 = await procesarResumenes(new Date(), { soloUsuario: U });
      marcar(r4.omitidos === 1 && r4.enviados === 0 && (await resumenes())[0]?.resultado === 'omitido: atrasado', 'con más de 30 min de atraso no se envía y queda anotado');
    }

    // Completar cancela.
    const t4 = await crearTarea(U, { titulo: 'Se completa (prueba recordatorios)', fechaLimite: pasado, horaInicio: '09:00', recordatorio: '1_hora' });
    await completarTarea(U, t4.id, 10);
    marcar((await fila(t4.id))?.estado === 'omitido', 'al completarla, su recordatorio se cancela');
  } finally {
    await sql.query('DELETE FROM envios WHERE usuario_id = $1', [U]);
    await sql.query('DELETE FROM suscripciones_push WHERE usuario_id = $1', [U]);
    await sql.query('DELETE FROM tareas_personales WHERE usuario_id = $1', [U]);
    await sql.query('DELETE FROM categorias WHERE usuario_id = $1', [U]);
    await sql.query('DELETE FROM preferencias_usuario WHERE usuario_id = $1', [U]);
    await sql.end();
    await admin.auth.admin.deleteUser(U);
    console.log('Usuario temporal borrado');
  }
  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error('Error inesperado:', e instanceof Error ? e.message : e);
  process.exit(1);
});
