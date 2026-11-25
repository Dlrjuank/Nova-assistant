// E18 (PLAN_AMPLIACION 9.2 a 9.4, 11.2; B-36 a B-38): generar un plan de estudio con Gemini real, a partir del
// syllabus de prueba de E17 y tres temas confirmados, contra la base real. Gasta 1 pedido de embeddings (con el
// caché de pruebas, ninguno la segunda vez) y 1 llamada al modelo (2 si el primer plan no cumple). Los temas se
// escriben a mano: proponerlos ya lo prueba `probar:temas`. Usuario temporal, borrado al final con todo lo suyo.
// Uso: npm run probar:plan
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { indexarContenido } from '@/lib/datos/documentos';
import { generarPlan, guardarVersionManual, obtenerPlan, restaurarVersion } from '@/lib/datos/planEstudio';
import { crearComponente, crearMateria, crearNota, dividirEnCortes, listarMaterias } from '@/lib/datos/semestre';
import { crearTema } from '@/lib/datos/temas';
import { llm } from '@/lib/llm/gemini';
import { hoyBogota, sumarDias } from '@/lib/reglas/fechas';
import { pasosDe } from '@/lib/reglas/planEstudio';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';
import { instalarCacheEmbeddings } from './cache-embeddings';
import { syllabusDePrueba } from './probar-temas';
import { conClaveDelProyecto } from '@/lib/llm/contextoIa';

cargarEnv();
instalarCacheEmbeddings(llm);

async function main(): Promise<void> {
  let fallas = 0;
  const marcar = (ok: boolean, texto: string, detalle = '') => {
    if (!ok) fallas++;
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}${detalle ? ` -> ${detalle}` : ''}`);
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error('Faltan las variables de Supabase');
  const admin = createClient(url, clave, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email: `probar-plan-${randomUUID()}@example.com`, password: `P-${randomUUID()}`, email_confirm: true });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  const U = data.user.id;
  const sql = new pg.Client(opcionesConexion(process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING as string));
  await sql.connect();
  const codigoDe = (p: Promise<unknown>) => p.then(() => 'ninguno', (e: { codigo?: string }) => e.codigo ?? 'otro');
  const hoy = hoyBogota();
  const fechaCorte = sumarDias(hoy, 21);

  try {
    const { id: MAT } = await crearMateria(U, { nombre: 'Cálculo plan', creditos: 4 });
    await dividirEnCortes(U, MAT);
    const [corte1, corte2] = ((await listarMaterias(U, MAT))[0]?.cortes ?? []).map((c) => c.id) as [string, string];
    const { id: componente } = await crearComponente(U, corte1, { nombre: 'Parcial', porcentaje: 100 });

    // Paso 1: el syllabus de la materia, indexado de verdad (embeddings del caché si ya se corrió probar:temas).
    const doc = await indexarContenido(U, syllabusDePrueba(), { nombreArchivo: 'syllabus-prueba.pdf', materiaId: MAT });
    marcar(doc.progreso === null, 'Paso 1: syllabus indexado con su materia');

    // Pasos 2 y 3: RB-19 y RB-20 sin gastar cuota.
    marcar((await codigoDe(generarPlan(U, corte2))) === 'PLAN_SIN_FECHA', 'Paso 2: corte sin fecha futura → RB-19');
    await sql.query('UPDATE cortes SET fecha = $2 WHERE id = $1', [corte1, fechaCorte]);
    marcar((await codigoDe(generarPlan(U, corte1))) === 'SIN_TEMAS_CONFIRMADOS', 'Paso 3: sin temas confirmados → RB-20');

    // Paso 4: tres temas confirmados y uno propuesto (no debe entrar al plan).
    const temas = [];
    for (const n of ['Límites y continuidad', 'Derivadas y reglas de derivación', 'Regla de la cadena']) temas.push(await crearTema(U, corte1, n));
    const propuesto = (
      await sql.query("INSERT INTO temas (usuario_id, corte_id, nombre, origen, estado, fuente) VALUES ($1, $2, 'Series de Taylor', 'asistente', 'propuesto', 'syllabus-prueba.pdf · p. 2') RETURNING id", [U, corte1])
    ).rows[0].id as string;
    marcar(temas.length === 3, 'Paso 4: tres temas confirmados y uno propuesto');

    // Paso 5: generar con Gemini real (B-36).
    const plan = await generarPlan(U, corte1);
    const pasos = pasosDe(plan.version.contenido);
    for (const p of pasos) console.log(`     ${p.fecha} · ${p.minutos} min · ${p.titulo} · ${temas.find((t) => t.id === p.tema_id)?.nombre ?? p.tema_id}${p.fuentes.length ? ` · ${p.fuentes.join(', ')}` : ''}`);
    const confirmados = new Set(temas.map((t) => t.id));
    marcar(plan.vigente === 1 && plan.version.origen === 'asistente' && pasos.length > 0, 'Paso 5: versión 1 del asistente, con pasos', `${pasos.length} pasos`);
    marcar(pasos.every((p) => confirmados.has(p.tema_id)) && !pasos.some((p) => p.tema_id === propuesto), 'Paso 6: solo temas confirmados (el propuesto no entra)');
    marcar(pasos.every((p) => p.fecha >= hoy && p.fecha <= fechaCorte), `Paso 7: todas las fechas entre hoy y el corte (${hoy} a ${fechaCorte})`);
    marcar(pasos.every((p) => p.fuentes.every((f) => f.startsWith('syllabus-prueba.pdf · '))), 'Paso 8: las citas son del PDF de la materia');
    marcar(confirmados.size === new Set(pasos.map((p) => p.tema_id)).size, 'Paso 9: cubre los tres temas');
    const semanas = plan.version.contenido.semanas;
    marcar(semanas.every((s, i) => i === 0 || s.inicio > (semanas[i - 1]?.inicio ?? '')), 'Paso 10: agrupado por semanas en orden');

    // Paso 11: RB-23 (B-37): una nota nueva se avisa y el plan no cambia solo.
    await crearNota(U, componente, { nota: '3,5' });
    const conCambios = await obtenerPlan(U, corte1);
    marcar(conCambios?.vigente === 1 && (conCambios?.cambios ?? []).includes('notas nuevas'), 'Paso 11: nota nueva → aviso RB-23, sigue la versión 1', (conCambios?.cambios ?? []).join(', '));

    // Paso 12: editar y restaurar (B-38).
    const [p1] = pasos;
    const editado = await guardarVersionManual(U, corte1, [{ id: p1?.id, titulo: 'Paso editado a mano', fecha: p1?.fecha ?? hoy, minutos: 30, temaId: p1?.tema_id ?? '' }]);
    const restaurado = await restaurarVersion(U, corte1, 1);
    marcar(
      editado.vigente === 2 && editado.version.origen === 'manual' && pasosDe(editado.version.contenido).length === 1 && restaurado.vigente === 3 && pasosDe(restaurado.version.contenido).length === pasos.length,
      'Paso 12: editar crea la versión 2 (manual); restaurar la 1 crea la 3 igual a la 1',
    );
  } catch (e) {
    marcar(false, 'Error inesperado', `${(e as { codigo?: string }).codigo ?? ''} ${(e as Error).message}`);
  } finally {
    await sql.query('DELETE FROM documentos WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.query('DELETE FROM materias WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.query('DELETE FROM categorias WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.query('DELETE FROM preferencias_usuario WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.end();
    const { error: errorBorrar } = await admin.auth.admin.deleteUser(U);
    if (errorBorrar) marcar(false, 'No se pudo borrar el usuario temporal', errorBorrar.message);
    else console.log('Usuario temporal borrado con sus materias, planes y documentos');
  }
  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

// E20c-1: con Gemini real y la clave del proyecto (fuera de conIaDe, gemini.ts no llama a Gemini).
void conClaveDelProyecto(main);
