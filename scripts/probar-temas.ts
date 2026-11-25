// E17 (PLAN_AMPLIACION 9.1, B-35): proponer temas desde un syllabus de prueba con temas conocidos, contra la base y
// Gemini reales (una llamada al modelo y pocos embeddings, reutilizados del caché de pruebas). Usuario temporal,
// borrado al final con todo lo suyo. Uso: npm run probar:temas
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { indexarContenido } from '@/lib/datos/documentos';
import { crearMateria, dividirEnCortes, listarMaterias } from '@/lib/datos/semestre';
import { crearTema, editarTema, listarTemas, proponerTemas } from '@/lib/datos/temas';
import { llm } from '@/lib/llm/gemini';
import { hoyBogota, sumarDias } from '@/lib/reglas/fechas';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';
import { instalarCacheEmbeddings } from './cache-embeddings';
import { generarLibroPdf } from './pdf-libro';
import { conClaveDelProyecto } from '@/lib/llm/contextoIa';

cargarEnv();
instalarCacheEmbeddings(llm);

/** Un syllabus de 2 páginas con los temas de cada corte (latin-1: Helvetica). */
export function syllabusDePrueba(): Uint8Array {
  return generarLibroPdf({
    paginas: [
      [
        'PROGRAMA DE LA ASIGNATURA: CALCULO DIFERENCIAL E INTEGRAL',
        'Objetivo: que el estudiante comprenda y aplique el calculo de una variable.',
        '',
        'CONTENIDOS DEL CORTE 1 (30 %)',
        'Unidad 1. Limites y continuidad de funciones.',
        'Unidad 2. Derivadas y reglas de derivacion.',
        'Unidad 3. Regla de la cadena y derivacion implicita.',
        '',
        'CONTENIDOS DEL CORTE 2 (30 %)',
        'Unidad 4. Integrales indefinidas y metodos de integracion.',
        'Unidad 5. Teorema fundamental del calculo.',
      ],
      [
        'CONTENIDOS DEL CORTE 3 (40 %)',
        'Unidad 6. Series de potencias y series de Taylor.',
        'Unidad 7. Aplicaciones de la integral: areas y volumenes.',
        '',
        'EVALUACION: parciales, talleres y quices en cada corte.',
        'BIBLIOGRAFIA: Stewart, Calculo de una variable.',
      ],
    ],
  });
}

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
  const { data, error } = await admin.auth.admin.createUser({ email: `probar-temas-${randomUUID()}@example.com`, password: `P-${randomUUID()}`, email_confirm: true });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  const U = data.user.id;
  const sql = new pg.Client(opcionesConexion(process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING as string));
  await sql.connect();
  const codigoDe = (p: Promise<unknown>) => p.then(() => 'ninguno', (e: { codigo?: string }) => e.codigo ?? 'otro');

  try {
    const { id: MAT } = await crearMateria(U, { nombre: 'Cálculo temas', creditos: 4 });
    await dividirEnCortes(U, MAT);
    const [corte1, corte2] = ((await listarMaterias(U, MAT))[0]?.cortes ?? []).map((c) => c.id) as [string, string];
    const { id: OTRA } = await crearMateria(U, { nombre: 'Otra materia', creditos: 2 });

    // Paso 1: el syllabus de la materia y uno de otra materia, indexados de verdad.
    const doc = await indexarContenido(U, syllabusDePrueba(), { nombreArchivo: 'syllabus-prueba.pdf', materiaId: MAT });
    const ajeno = await indexarContenido(U, syllabusDePrueba(), { nombreArchivo: 'otro.pdf', materiaId: OTRA });
    marcar(doc.progreso === null && ajeno.progreso === null, 'Paso 1: dos PDF indexados, cada uno con su materia');

    // Pasos 2 y 3: RB-19 y RB-21, sin gastar cuota.
    marcar((await codigoDe(proponerTemas(U, corte1, doc.documentoId))) === 'PLAN_SIN_FECHA', 'Paso 2: sin fecha futura en el corte → RB-19');
    await sql.query('UPDATE cortes SET fecha = $2 WHERE id = $1', [corte1, sumarDias(hoyBogota(), 30)]);
    marcar((await codigoDe(proponerTemas(U, corte1, ajeno.documentoId))) === 'SIN_SYLLABUS', 'Paso 3: un PDF de otra materia → RB-21');

    // Paso 4: un tema a mano nace confirmado; repetido se rechaza.
    await crearTema(U, corte1, 'Límites y continuidad');
    marcar((await codigoDe(crearTema(U, corte1, 'LÍMITES Y CONTINUIDAD'))) === 'TEMA_DUPLICADO', 'Paso 4: tema a mano confirmado; el mismo con otras mayúsculas se rechaza');

    // Paso 5: proponer con Gemini real.
    const propuestos = await proponerTemas(U, corte1, doc.documentoId);
    const nombres = propuestos.map((t) => t.nombre.toLowerCase());
    console.log('     Propuestos:', propuestos.map((t) => `${t.nombre} (${t.fuente})`).join('; '));
    marcar(propuestos.length > 0 && propuestos.every((t) => t.estado === 'propuesto' && t.origen === 'asistente' && /^syllabus-prueba\.pdf · /.test(t.fuente ?? '')), 'Paso 5: se guardan como propuestos, con la fuente del syllabus');
    marcar(nombres.some((n) => n.includes('deriva')) && nombres.some((n) => n.includes('cadena')), 'Paso 6: incluye los temas conocidos del Corte 1 (derivadas, regla de la cadena)');
    marcar(!nombres.some((n) => n.includes('límites') || n.includes('limites')), 'Paso 7: no repite el que ya estaba a mano');
    marcar(!nombres.some((n) => n.includes('series') || n.includes('taylor')), 'Paso 8: no trae temas del Corte 3', nombres.join(', '));

    // Paso 9: confirmar uno; solo los confirmados cuentan. Los temas son del corte.
    await editarTema(U, propuestos[0]?.id as string, { confirmar: true });
    const temas = await listarTemas(U, MAT);
    marcar(temas.filter((t) => t.estado === 'confirmado').length === 2 && temas.every((t) => t.corteId === corte1) && !temas.some((t) => t.corteId === corte2), 'Paso 9: 2 confirmados, todos en el Corte 1');
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
    else console.log('Usuario temporal borrado con sus materias y documentos');
  }
  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/probar-temas.ts')) // E20c-1: con Gemini real y la clave del proyecto (fuera de conIaDe, gemini.ts no llama a Gemini).
void conClaveDelProyecto(main);
