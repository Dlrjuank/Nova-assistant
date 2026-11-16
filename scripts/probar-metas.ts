// E15 (PLAN_AMPLIACION 7.8, B-33): metas semanales contra la base real, con valores hechos a mano.
// Ejecutar: npm run probar:metas. Usa un usuario temporal y lo borra al final con todo lo que creó. Sin Gemini.
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { actualizarCategoria, crearCategoria, eliminarCategoria } from '@/lib/datos/categorias';
import { crearMetaSemanal, listarMetasSemanales } from '@/lib/datos/metasSemanales';
import { sumarDias } from '@/lib/reglas/fechas';
import { semanaActual, textoProgreso } from '@/lib/reglas/metasSemanales';
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
  const directa = process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING;
  if (!url || !clave || !directa) throw new Error('Faltan variables de entorno de la base o de Supabase.');
  const admin = createClient(url, clave, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email: `nova-prueba-metas-${Date.now()}@example.com`, password: `Prueba-${randomBytes(12).toString('hex')}`, email_confirm: true });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario temporal: ${error?.message}`);
  const U = data.user.id;
  const sql = new pg.Client(opcionesConexion(directa));
  await sql.connect();
  const { lunes, domingo } = semanaActual();

  // Tareas completadas: cierre en la semana (lunes y domingo), la semana pasada y una pendiente con fecha límite de hoy.
  const tarea = (titulo: string, categoria: string, cierre: string | null, minutos: number | null) =>
    sql.query(
      `INSERT INTO tareas_personales (titulo, categoria, prioridad, estado, fecha_limite, fecha_creacion, fecha_cierre, minutos_invertidos, usuario_id)
       VALUES ($1, $2, 2, $3, $4, $4, $5, $6, $7)`,
      [titulo, categoria, cierre ? 'Completada' : 'Pendiente', cierre ?? lunes, cierre, minutos ?? 0, U],
    );

  try {
    await crearCategoria(U, { nombre: 'Universidad' });
    await tarea('Prueba metas 1', 'Universidad', lunes, 90);
    await tarea('Prueba metas 2', 'universidad', domingo, 110);
    await tarea('Prueba metas 3', 'General', domingo, 30);
    await tarea('Prueba metas 4', 'Universidad', sumarDias(lunes, -1), 500); // domingo pasado: no cuenta
    await tarea('Prueba metas 5', 'Universidad', null, null); // pendiente: no cuenta

    // Paso 1 (B-33): meta global de 5 tareas → 3 de 5; meta de 3 h en Universidad → 3 h 20 min de 3 h, cumplida.
    await crearMetaSemanal(U, { tipo: 'tareas', objetivo: '5' });
    await crearMetaSemanal(U, { tipo: 'minutos', categoria: 'universidad', horas: '3', minutos: '' });
    const r = await listarMetasSemanales(U);
    const global = r.metas.find((m) => m.tipo === 'tareas');
    const tiempo = r.metas.find((m) => m.tipo === 'minutos');
    marcar(r.lunes === lunes && r.domingo === domingo, 'Paso 1: la semana actual de Bogotá', `${r.lunes} a ${r.domingo}`);
    marcar(global?.progreso === 3 && global.porcentaje === 60 && !global.cumplida, 'Paso 2: 5 tareas → "3 de 5 tareas", 60 %', global ? textoProgreso(global, global.progreso) : 'sin meta');
    marcar(
      tiempo?.categoria === 'Universidad' && tiempo.progreso === 200 && tiempo.porcentaje === 100 && tiempo.cumplida,
      'Paso 3: 3 h en Universidad (sin mayúsculas) → "3 h 20 min de 3 h", cumplida',
      tiempo ? textoProgreso(tiempo, tiempo.progreso) : 'sin meta',
    );

    // Paso 4: RB-17.
    let codigo = '';
    await crearMetaSemanal(U, { tipo: 'tareas', objetivo: 9 }).catch((e: { codigo?: string }) => (codigo = e.codigo ?? 'otro'));
    marcar(codigo === 'META_SEMANAL_DUPLICADA', 'Paso 4: la misma meta otra vez → "Ya tienes una meta igual."');

    // Pasos 5 y 6: renombrar la categoría renombra la meta; eliminarla elimina la meta.
    const categoria = (await sql.query<{ id: string }>("SELECT id FROM categorias WHERE usuario_id = $1 AND nombre = 'Universidad'", [U])).rows[0]?.id as string;
    await actualizarCategoria(U, categoria, { nombre: 'U' });
    const renombrada = (await listarMetasSemanales(U)).metas.find((m) => m.tipo === 'minutos');
    marcar(renombrada?.categoria === 'U' && renombrada.progreso === 200, 'Paso 5: renombrar la categoría la renombra en la meta y sigue contando');
    await eliminarCategoria(U, categoria);
    const tras = (await listarMetasSemanales(U)).metas;
    marcar(tras.length === 1 && tras[0]?.tipo === 'tareas', 'Paso 6: eliminar la categoría elimina su meta; la global queda');
  } catch (e) {
    marcar(false, 'Error inesperado', `${(e as { codigo?: string }).codigo ?? ''} ${(e as Error).message}`);
  } finally {
    await sql.query('DELETE FROM metas_semanales WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.query('DELETE FROM tareas_personales WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.query('DELETE FROM categorias WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.end();
    const { error: errorBorrar } = await admin.auth.admin.deleteUser(U);
    if (errorBorrar) marcar(false, 'No se pudo borrar el usuario temporal', errorBorrar.message);
    else console.log('Usuario temporal borrado con sus metas y tareas');
  }
  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

void main();
