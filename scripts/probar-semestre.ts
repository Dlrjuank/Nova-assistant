// E13 (PLAN_AMPLIACION 7.4 a 7.6, 11.2): la calculadora de notas contra la base real y valores hechos a mano.
// Ejecutar: npm run probar:semestre. Usa un usuario temporal y lo borra al final con todo lo que creó. Sin Gemini.
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { eventosSemestre, crearComponente, crearMateria, crearNota, dividirEnCortes, listarMaterias, type Materia } from '@/lib/datos/semestre';
import { listarDocumentos } from '@/lib/datos/documentos';
import { aprueba, calcularMateria, cuantoNecesito, estadoDe, promedioSemestre, textoCuantoNecesito, textoNota, type MateriaEntrada } from '@/lib/reglas/notas';
import { hoyBogota } from '@/lib/reglas/fechas';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();

let fallas = 0;
function marcar(ok: boolean, texto: string, detalle = ''): void {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}${detalle ? ` -> ${detalle}` : ''}`);
}

const entrada = (m: Materia): MateriaEntrada => ({
  usaCortes: m.usaCortes,
  cortes: m.cortes.map((c) => ({ nombre: c.nombre, porcentaje: c.porcentaje, componentes: c.componentes.map((k) => ({ nombre: k.nombre, porcentaje: k.porcentaje, notas: k.notas.map((n) => n.nota) })) })),
});

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY;
  const directa = process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING;
  if (!url || !clave || !directa) throw new Error('Faltan variables de entorno de la base o de Supabase.');
  const admin = createClient(url, clave, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email: `nova-prueba-semestre-${Date.now()}@example.com`, password: `Prueba-${randomBytes(12).toString('hex')}`, email_confirm: true });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario temporal: ${error?.message}`);
  const U = data.user.id;
  const sql = new pg.Client(opcionesConexion(directa));
  await sql.connect();

  try {
    // Paso 1: el ejemplo hecho a mano de 7.4, creado con los mismos servicios que usa la pantalla.
    const { id: MAT } = await crearMateria(U, { nombre: 'Prueba Semestre 7.4', creditos: '3' });
    const corte = (await listarMaterias(U, MAT))[0]?.cortes[0]?.id as string;
    const parcial = (await crearComponente(U, corte, { nombre: 'Parcial', porcentaje: '40' })).id;
    const talleres = (await crearComponente(U, corte, { nombre: 'Talleres', porcentaje: '20' })).id;
    const quizzes = (await crearComponente(U, corte, { nombre: 'Quizzes', porcentaje: '20' })).id;
    await crearComponente(U, corte, { nombre: 'Actividades', porcentaje: '20' }); // sin notas: pendiente completo
    await crearNota(U, parcial, { nota: '3,5', fecha: hoyBogota() });
    await crearNota(U, talleres, { nota: '4' });
    await crearNota(U, talleres, { nota: '4,4' });
    for (const nota of ['3', '5', null, null, null]) await crearNota(U, quizzes, { nota });
    const ejemplo = (await listarMaterias(U, MAT))[0] as Materia;
    const c = calcularMateria(entrada(ejemplo));
    marcar(c.actual !== null && textoNota(c.actual, 'truncar') === '3,7', 'Paso 1: nota actual 3,7 (lo que falta no cuenta como 0)', c.actual ? `${Number(c.actual.n) / Number(c.actual.d) / 100}` : 'sin nota');
    marcar(textoNota(c.asegurado, 'truncar') === '2,5', 'Paso 2: asegurado 2,5');
    marcar(estadoDe(c, 300, 'truncar') === 'Aprueba', 'Paso 3: estado "Aprueba" con 3,0 para aprobar');

    // Pasos 4 a 6: "¿Cuánto necesito?" (7.5).
    const necesito = (o: number, r: 'truncar' | 'redondear' = 'truncar') => {
      const x = cuantoNecesito(c, o, r);
      return x ? textoCuantoNecesito(x, o) : '';
    };
    marcar(necesito(300) === 'Necesitas al menos 1,4 en lo que falta para llegar a 3,0.', 'Paso 4: 1,4 para aprobar', necesito(300));
    marcar(necesito(400) === 'Necesitas al menos 4,5 en lo que falta para llegar a 4,0.', 'Paso 5: 4,5 para la meta 4,0', necesito(400));
    marcar(necesito(450) === 'Con lo que falta no es posible llegar a 4,5. Lo máximo que puedes alcanzar es 4,1.', 'Paso 6: la meta 4,5 no es posible; máximo 4,1', necesito(450));
    marcar(necesito(300, 'redondear') === 'Necesitas al menos 1,3 en lo que falta para llegar a 3,0.', 'Paso 7: al redondear, el umbral baja 0,05 (1,3)', necesito(300, 'redondear'));

    // Paso 8: truncar frente a redondear con una nota exacta de 2,96 (B-29).
    const { id: M2 } = await crearMateria(U, { nombre: 'Prueba Semestre 2,96', creditos: 1 });
    const corte2 = (await listarMaterias(U, M2))[0]?.cortes[0]?.id as string;
    await crearNota(U, (await crearComponente(U, corte2, { nombre: 'Final', porcentaje: '100' })).id, { nota: '2,96' });
    const c2 = calcularMateria(entrada((await listarMaterias(U, M2))[0] as Materia));
    const actual2 = c2.actual as NonNullable<typeof c2.actual>;
    marcar(
      textoNota(actual2, 'truncar') === '2,9' && !aprueba(actual2, 300, 'truncar') && textoNota(actual2, 'redondear') === '3,0' && aprueba(actual2, 300, 'redondear'),
      'Paso 8: 2,96 → "2,9" sin aprobar al truncar; "3,0" y aprueba al redondear',
    );
    marcar(estadoDe(c2, 300, 'truncar') === 'Reprobada' && estadoDe(c2, 300, 'redondear') === 'Aprobada', 'Paso 9: con todo calificado, Reprobada o Aprobada según el redondeo');

    // Paso 10: promedio por créditos (B-31): (256/68 × 3 + 2,96 × 1) / 4 = 3,5636… → 3,5.
    const p = promedioSemestre([
      { creditos: 3, calculo: c },
      { creditos: 1, calculo: c2 },
    ]);
    marcar(p.actual !== null && textoNota(p.actual, 'truncar') === '3,5' && p.asegurado !== null && textoNota(p.asegurado, 'truncar') === '2,6', 'Paso 10: promedio ponderado por créditos 3,5; asegurado 2,6', `asegurado (2,56 × 3 + 2,96) / 4 = 2,66`);

    // Paso 11: con cortes, cada corte con su nota.
    await dividirEnCortes(U, MAT);
    const conCortes = (await listarMaterias(U, MAT))[0] as Materia;
    const cc = calcularMateria(entrada(conCortes));
    marcar(conCortes.cortes.length === 3 && cc.actual !== null && textoNota(cc.actual, 'truncar') === '3,7' && !cc.sumasOk, 'Paso 11: al dividir, el Corte 1 conserva las notas; sin componentes en los otros cortes no hay estado');

    // Paso 12: Calendario: la nota con fecha aparece en su día y enlaza a la materia (B-15).
    const eventos = await eventosSemestre(U, hoyBogota(), hoyBogota());
    const deHoy = eventos[hoyBogota()] ?? [];
    marcar(deHoy.some((e) => e.tipo === 'nota' && e.materiaId === MAT && e.titulo === 'Parcial · Prueba Semestre 7.4'), 'Paso 12: la nota con fecha aparece en el Calendario', deHoy.map((e) => e.titulo).join(', '));

    // Paso 13: un documento de la materia se lista con ella (B-21).
    await sql.query("INSERT INTO documentos (nombre_archivo, categoria, fecha_guardado, usuario_id, materia_id) VALUES ('prueba-semestre.pdf', 'Prueba Semestre 7.4', $1, $2, $3)", [hoyBogota(), U, MAT]);
    const docs = await listarDocumentos(U);
    marcar(docs[0]?.materia === 'Prueba Semestre 7.4', 'Paso 13: la lista de documentos muestra la materia');
  } catch (e) {
    marcar(false, 'Error inesperado', `${(e as { codigo?: string }).codigo ?? ''} ${(e as Error).message}`);
  } finally {
    await sql.query('DELETE FROM documentos WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.query('DELETE FROM materias WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.query('DELETE FROM categorias WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.end();
    const { error: errorBorrar } = await admin.auth.admin.deleteUser(U);
    if (errorBorrar) marcar(false, 'No se pudo borrar el usuario temporal', errorBorrar.message);
    else console.log('Usuario temporal borrado con sus materias');
  }
  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

void main();
