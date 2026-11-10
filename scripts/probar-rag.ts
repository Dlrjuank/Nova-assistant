// Prueba el flujo RAG completo contra la base y Gemini (plan, sección 17.2). Ejecutar: npm run probar:rag
// Importa de lib/datos y no de dataService, que usa 'server-only' y solo carga dentro de Next.
// Para verificar y limpiar usa su propio cliente pg, como los demás scripts: solo lib/datos importa conexion.ts.
import { head, put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { consultar } from '@/lib/datos/consulta';
import {
  eliminarDocumento,
  emitirTokenSubida,
  existenDocumentos,
  indexarContenido,
  indexarDocumento,
  listarDocumentos,
} from '@/lib/datos/documentos';
import { recuperarFragmentos } from '@/lib/datos/fragmentos';
import { completarTarea, crearTarea, eliminarTarea, hayTareasPendientes, listarTareas } from '@/lib/datos/tareas';
import { SIN_DOCUMENTOS_RESPUESTA, SIN_RESPUESTA, SIN_TAREAS_PENDIENTES } from '@/lib/llm/prompts';
import { hoyBogota, sumarDias } from '@/lib/reglas/fechas';
import { llm } from '@/lib/llm/gemini';
import { responderConFuentesWeb, responderConWikipedia } from '@/lib/datos/consultaWeb';
import { eliminarFuenteWeb, guardarFuenteWeb, listarFuentesWeb } from '@/lib/datos/wikipedia';
import { SIN_FUENTES_WEB } from '@/lib/llm/prompts';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';
import { instalarCacheEmbeddings } from './cache-embeddings';

cargarEnv();
const resumenEmbeddings = instalarCacheEmbeddings(llm);

const NOMBRE_PDF = 'prueba-nova-rag.pdf';

/** Genera un PDF real (con xref) a partir de líneas de texto, en WinAnsi para admitir tildes. */
function generarPdf(lineas: string[]): Uint8Array {
  const escapar = (t: string) => t.replace(/([\\()])/g, '\\$1');
  const flujo = `BT /F1 10 Tf 40 780 Td 12 TL\n${lineas.map((l) => `(${escapar(l)}) Tj T*`).join('\n')}\nET`;
  const objetos = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${flujo.length}>>stream\n${flujo}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
  ];
  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((cuerpo, i) => {
    const posicion = pdf.length;
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
    return posicion;
  });
  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer<</Size ${objetos.length + 1}/Root 1 0 R>>\nstartxref\n${inicioXref}\n%%EOF`;
  return Uint8Array.from(Buffer.from(pdf, 'latin1'));
}

// Más de 500 palabras, para que salgan varios fragmentos.
const LINEAS_PDF = [
  'Manual del purificador de agua AquaNova.',
  'La garantía del producto es de 24 meses desde la fecha de compra.',
  'El filtro principal debe cambiarse cada 6 meses.',
  'Pasos para cambiar el filtro: primero, cerrar la llave de paso; segundo, girar la carcasa hacia la izquierda; tercero, colocar el filtro nuevo.',
  ...Array.from(
    { length: 70 },
    (_, i) => `Apartado ${i + 1}: limpie la carcasa exterior con un paño húmedo y revise las conexiones de la manguera.`,
  ),
  'El centro de servicio técnico atiende en la ciudad de Santa Marta.',
];

let fallas = 0;
function marcar(ok: boolean, texto: string, detalle = ''): void {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}${detalle ? ` -> ${detalle}` : ''}`);
}

async function codigoDe(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return '(sin error)';
  } catch (e) {
    return (e as { codigo?: string }).codigo ?? `inesperado: ${(e as Error).message}`;
  }
}

/** Sube el PDF como lo hace el navegador en P07: pide el token de un solo uso y sube con él. */
async function subirABlob(contenido: Uint8Array, nombre: string): Promise<string> {
  const peticion = new Request('http://localhost/api/nova/documentos/subida', { method: 'POST' });
  const emitido = await emitirTokenSubida(
    { type: 'blob.generate-client-token', payload: { pathname: nombre, clientPayload: null, multipart: false } },
    peticion,
  );
  if (emitido.type !== 'blob.generate-client-token') throw new Error('No se emitió el token de subida');
  const blob = await put(nombre, Buffer.from(contenido), {
    access: 'public',
    token: emitido.clientToken,
    contentType: 'application/pdf',
  });
  return blob.url;
}

/** Cliente de administración de Supabase, para crear y borrar el usuario temporal del paso 10. */
function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error('Faltan la URL o la clave de servicio de Supabase');
  return createClient(url, clave, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function main(): Promise<void> {
  const sql = new pg.Client(opcionesConexion(process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING as string));
  await sql.connect();
  const tareasCreadas: string[] = [];
  const documentosCreados: string[] = [];
  const URL_FUENTE = 'https://es.wikipedia.org/wiki/Prueba_Nova_purificador';
  let usuarioFuente: string | undefined;

  // Todo se crea a nombre del dueño por defecto (M5), es decir, la cuenta del usuario.
  const { rows: config } = await sql.query<{ valor: string }>(
    "SELECT valor FROM nova_config WHERE clave = 'dueno_por_defecto'",
  );
  const DUENO = config[0]?.valor;
  if (!DUENO) throw new Error('Falta nova_config.dueno_por_defecto: aplique la migración M5 (npm run db:migrar)');

  // Paso 10 (RB-01): otro usuario, temporal, que no debe ver nada del dueño. Se borra al final.
  const admin = supabaseAdmin();
  const { data: creado, error: errorUsuario } = await admin.auth.admin.createUser({
    email: `nova-prueba-aislamiento-${Date.now()}@example.com`,
    password: `Prueba-${crypto.randomUUID()}`,
    email_confirm: true,
  });
  if (errorUsuario || !creado.user) throw new Error(`No se pudo crear el usuario temporal: ${errorUsuario?.message}`);
  const OTRO = creado.user.id;

  try {
    // RB-32: sin documentos la consulta ya no se bloquea; se explica en la respuesta (lo cubre el paso 10d).
    if ((await existenDocumentos(DUENO)) || (await hayTareasPendientes(DUENO))) {
      console.log('OMITIDO paso 9: la cuenta ya tiene documentos o tareas pendientes (el paso 10d prueba ese caso)');
    } else {
      const sinNada = await consultar(DUENO, '¿Qué dice mi documento?');
      marcar(sinNada.respuesta === SIN_DOCUMENTOS_RESPUESTA, 'Paso 9: sin documentos ni tareas, pregunta de documento', sinNada.respuesta);
    }

    const tarea = await crearTarea(DUENO, {
      titulo: 'Prueba renovar pasaporte',
      prioridad: 3,
      fechaLimite: '2099-01-15',
    });
    tareasCreadas.push(tarea.id);
    marcar(
      tarea.estado === 'Pendiente' && tarea.prioridad === 3 && tarea.fechaCreacion === hoyBogota(),
      'Paso 1: tarea creada, Pendiente',
      `${tarea.titulo}, categoría ${tarea.categoria}, límite ${tarea.fechaLimite}`,
    );

    const prioridad = await codigoDe(() =>
      crearTarea(DUENO, { titulo: 'Prueba prioridad', prioridad: 7, fechaLimite: '2099-01-15' }),
    );
    marcar(prioridad === 'PRIORIDAD_INVALIDA', 'Paso 2: prioridad 7', prioridad);

    const fecha = await codigoDe(() => crearTarea(DUENO, { titulo: 'Prueba fecha', fechaLimite: '2026-02-30' }));
    marcar(fecha === 'FECHA_INVALIDA', 'Paso 3: fecha 2026-02-30', fecha);

    const noPdf = await codigoDe(() =>
      emitirTokenSubida(
        { type: 'blob.generate-client-token', payload: { pathname: 'prueba.txt', clientPayload: null, multipart: false } },
        new Request('http://localhost/', { method: 'POST' }),
      ),
    );
    marcar(noPdf === 'PDF_INVALIDO', 'Paso 4a: el token de subida rechaza lo que no es PDF', noPdf);

    const urlBlob = await subirABlob(generarPdf(LINEAS_PDF), NOMBRE_PDF);
    marcar(urlBlob.includes('.blob.vercel-storage.com/'), 'Paso 4b: PDF subido a Vercel Blob con token de un solo uso');

    const { documentoId, numFragmentos } = await indexarDocumento(DUENO, { urlBlob, nombreArchivo: NOMBRE_PDF });
    documentosCreados.push(documentoId);
    marcar(numFragmentos > 1, 'Paso 4: PDF descargado de Blob e indexado', `${numFragmentos} fragmentos`);

    const sigueEnBlob = await head(urlBlob).then(
      () => true,
      () => false,
    );
    marcar(!sigueEnBlob, 'Paso 4c: el PDF ya no está en Blob tras indexarlo');

    const { rows } = await sql.query<{ n: number; dims: number }>(
      'SELECT COUNT(*)::int AS n, MIN(vector_dims(vector)) AS dims FROM fragmentos_pdf WHERE documento_id = $1',
      [documentoId],
    );
    const guardados = rows[0];
    marcar(
      guardados?.n === numFragmentos && guardados?.dims === 768,
      'Paso 4d: fragmentos guardados en la base',
      `${guardados?.n} filas de ${guardados?.dims} dimensiones`,
    );

    const corta = await codigoDe(() => consultar(DUENO, 'info'));
    marcar(corta === 'CONSULTA_MUY_CORTA', 'Paso 5: consulta "info"', corta);

    const dato = await consultar(DUENO, '¿Cuántos meses dura la garantía del purificador?');
    marcar(
      dato.respuesta.includes('24') && dato.fuentes.some((f) => f.tipo === 'pdf' && f.etiqueta.includes(NOMBRE_PDF)),
      'Paso 6: dato presente en el PDF',
      `${dato.respuesta} | fuentes: ${dato.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );

    // RN-21: la pregunta de seguimiento solo se entiende con la anterior.
    const primera = '¿Cuáles son los pasos para cambiar el filtro?';
    const pasos = await consultar(DUENO, primera);
    const seguimiento = await consultar(DUENO, '¿y el segundo?', [
      { autor: 'usuario', texto: primera },
      { autor: 'asistente', texto: pasos.respuesta },
    ]);
    marcar(
      /gira/i.test(seguimiento.respuesta) && seguimiento.respuesta !== SIN_RESPUESTA,
      'Paso 6b: seguimiento "¿y el segundo?" con el historial',
      `${seguimiento.respuesta} | fuentes: ${seguimiento.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );

    const pendientes = await consultar(DUENO, '¿Qué tareas tengo pendientes?');
    marcar(
      // Solo la tarea: si aparecen fragmentos, el modelo no citó la etiqueta y armarFuentes devolvió todas.
      /pasaporte/i.test(pendientes.respuesta) &&
        pendientes.fuentes.length > 0 &&
        pendientes.fuentes.every((f) => f.tipo === 'tarea'),
      'Paso 7: tareas pendientes',
      `${pendientes.respuesta} | fuentes: ${pendientes.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );

    // Paso 10 (RB-01): aislamiento en la base real. Nada de esto llama a Gemini.
    const { rows: duenos } = await sql.query<{ tarea: string; documento: string }>(
      `SELECT (SELECT usuario_id FROM tareas_personales WHERE id = $1)::text AS tarea,
              (SELECT usuario_id FROM documentos WHERE id = $2)::text AS documento`,
      [tarea.id, documentoId],
    );
    marcar(duenos[0]?.tarea === DUENO && duenos[0]?.documento === DUENO, 'Paso 10a: la tarea y el documento quedan con su dueño');
    const tareasOtro = await listarTareas(OTRO);
    const documentosOtro = await listarDocumentos(OTRO);
    marcar(
      !tareasOtro.some((t) => t.id === tarea.id) && !documentosOtro.some((d) => d.id === documentoId),
      'Paso 10b: otro usuario no ve la tarea ni el documento',
      `${tareasOtro.length} tareas, ${documentosOtro.length} documentos`,
    );
    const { rows: vectores } = await sql.query<{ v: string }>(
      'SELECT vector::text AS v FROM fragmentos_pdf WHERE documento_id = $1 AND numero = 1',
      [documentoId],
    );
    const vector = JSON.parse(vectores[0]?.v ?? '[]') as number[];
    const [delDueno, delOtro] = await Promise.all([
      recuperarFragmentos(DUENO, vector, 4),
      recuperarFragmentos(OTRO, vector, 4),
    ]);
    marcar(
      delDueno.some((f) => f.documento_id === documentoId) && delOtro.length === 0,
      'Paso 10c: la búsqueda vectorial solo devuelve fragmentos del usuario',
      `dueño ${delDueno.length}, otro ${delOtro.length}`,
    );
    // Paso 10d (RB-32): sin documentos y sin tareas, la pregunta no se bloquea.
    const sinDocs = await consultar(OTRO, '¿Qué dice mi documento?');
    marcar(
      sinDocs.respuesta === SIN_DOCUMENTOS_RESPUESTA && sinDocs.fuentes.length === 0,
      'Paso 10d: sin documentos ni tareas, pregunta de documento -> explica que no hay documentos',
      sinDocs.respuesta,
    );
    const sinTareas = await consultar(OTRO, '¿Tengo alguna tarea?');
    marcar(
      sinTareas.respuesta === SIN_TAREAS_PENDIENTES && sinTareas.fuentes.length === 0,
      'Paso 10e: sin documentos ni tareas, "¿Tengo alguna tarea?" -> "No tienes tareas pendientes."',
      sinTareas.respuesta,
    );
    // Paso 11 (RB-30): sin documentos pero con una tarea pendiente, el asistente responde con la tarea.
    const tareaOtro = await crearTarea(OTRO, { titulo: 'Prueba pagar el recibo de la luz', prioridad: 3, fechaLimite: '2099-02-01' });
    tareasCreadas.push(tareaOtro.id);
    const soloTareas = await consultar(OTRO, '¿Qué tareas tengo pendientes?');
    marcar(
      /luz/i.test(soloTareas.respuesta) && soloTareas.fuentes.length > 0 && soloTareas.fuentes.every((f) => f.tipo === 'tarea'),
      'Paso 11a: sin documentos y con una tarea pendiente, responde con la tarea',
      `${soloTareas.respuesta} | fuentes: ${soloTareas.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );
    const soloPdf = await consultar(OTRO, '¿Cuántos meses dura la garantía del purificador?');
    marcar(
      soloPdf.respuesta === SIN_DOCUMENTOS_RESPUESTA && soloPdf.fuentes.length === 0,
      'Paso 11b: sin documentos y con tareas, una pregunta de PDF -> explica que no hay documentos',
      `${soloPdf.respuesta} | ${soloPdf.fuentes.length} fuentes`,
    );

    // Paso 12 (RB-31): preguntas por fechas. La única tarea del usuario temporal vence en 2099.
    const semana = await consultar(OTRO, '¿Qué tengo para hacer esta semana?');
    marcar(
      /no tienes tareas para esta semana/i.test(semana.respuesta) && /luz/i.test(semana.respuesta),
      'Paso 12a: sin tareas esta semana -> "No tienes tareas para esta semana" y la más próxima',
      `${semana.respuesta} | fuentes: ${semana.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );
    const manana = sumarDias(hoyBogota(), 1);
    const tareaManana = await crearTarea(OTRO, { titulo: 'Prueba llevar el carro al taller', fechaLimite: manana });
    tareasCreadas.push(tareaManana.id);
    const paraManana = await consultar(OTRO, '¿Qué tengo para mañana?');
    marcar(
      /taller/i.test(paraManana.respuesta) &&
        !/luz/i.test(paraManana.respuesta) &&
        paraManana.fuentes.some((f) => f.etiqueta === `Tarea ${tareaManana.id.slice(0, 8)}`),
      `Paso 12b: "¿Qué tengo para mañana?" (${manana}) -> la tarea de mañana, citada`,
      `${paraManana.respuesta} | fuentes: ${paraManana.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );
    const primero = await consultar(OTRO, '¿Qué vence primero?');
    marcar(
      /taller/i.test(primero.respuesta),
      'Paso 12c: "¿Qué vence primero?" -> la de fecha límite más próxima',
      `${primero.respuesta} | fuentes: ${primero.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );

    // Paso 14 (RB-34): el horario llega al modelo; "¿qué tengo a las 3?" responde con la tarea de esa hora.
    const tareaHora = await crearTarea(OTRO, {
      titulo: 'Prueba reunión con el profesor',
      fechaLimite: manana,
      horaInicio: '15:00',
      horaFin: '16:00',
    });
    tareasCreadas.push(tareaHora.id);
    const aLasTres = await consultar(OTRO, '¿Qué tengo mañana a las 3 de la tarde?');
    marcar(
      tareaHora.horaInicio === '15:00' && tareaHora.horaFin === '16:00' && /reuni[oó]n/i.test(aLasTres.respuesta) && !/taller/i.test(aLasTres.respuesta),
      'Paso 14: "¿Qué tengo mañana a las 3 de la tarde?" -> la tarea de 15:00 a 16:00',
      `${aLasTres.respuesta} | fuentes: ${aLasTres.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );

    // Paso 13 (RB-32): con documentos y sin tareas pendientes. Se completan las tareas del usuario temporal
    // y se le indexa el PDF de prueba (un lote de embeddings).
    await completarTarea(OTRO, tareaOtro.id, 10);
    await completarTarea(OTRO, tareaManana.id, 10);
    await completarTarea(OTRO, tareaHora.id, 10);
    const conDocs = await indexarContenido(OTRO, generarPdf(LINEAS_PDF), { nombreArchivo: NOMBRE_PDF });
    documentosCreados.push(conDocs.documentoId);
    const docsSinTareas = await consultar(OTRO, '¿Tengo alguna tarea?');
    marcar(
      docsSinTareas.respuesta === SIN_TAREAS_PENDIENTES && docsSinTareas.fuentes.length === 0,
      'Paso 13: con documentos y sin tareas, "¿Tengo alguna tarea?" -> "No tienes tareas pendientes."',
      docsSinTareas.respuesta,
    );

    const ajenas = [
      await codigoDe(() => completarTarea(OTRO, tarea.id, 10)),
      await codigoDe(() => eliminarTarea(OTRO, tarea.id)),
      await codigoDe(() => eliminarDocumento(OTRO, documentoId)),
    ];
    const { rows: siguen } = await sql.query<{ estado: string; doc: boolean }>(
      `SELECT (SELECT estado FROM tareas_personales WHERE id = $1) AS estado,
              EXISTS (SELECT 1 FROM documentos WHERE id = $2) AS doc`,
      [tarea.id, documentoId],
    );
    marcar(
      ajenas.join() === 'TAREA_NO_ENCONTRADA,TAREA_NO_ENCONTRADA,DOCUMENTO_NO_ENCONTRADO' &&
        siguen[0]?.estado === 'Pendiente' &&
        siguen[0]?.doc === true,
      'Paso 10f: otro usuario no puede completar ni eliminar lo ajeno (como si no existiera)',
      ajenas.join(', '),
    );

    // E10c2 (RB-55, RB-56, RB-58): con el usuario temporal, para no tocar las fuentes del dueño.
    const sinFuentes = await responderConFuentesWeb(OTRO, '¿Qué dice mi fuente guardada?');
    marcar(sinFuentes.respuesta === SIN_FUENTES_WEB && sinFuentes.fuentes.length === 0, 'Paso 15a: sin fuentes guardadas -> el aviso de RB-56', sinFuentes.respuesta);
    usuarioFuente = OTRO;
    const guardada = await guardarFuenteWeb(OTRO, {
      url: URL_FUENTE,
      resumen: 'El filtro de carbón del purificador Aquaclara se cambia cada nueve meses y su tanque guarda doce litros.',
      categoria: 'Pruebas',
    });
    marcar(guardada.fuentesEnCategoria === 1, 'Paso 15b: "Guardar fuente" guarda en la categoría', `${guardada.categoria}, ${guardada.fuentesEnCategoria}`);
    const repetida = await guardarFuenteWeb(OTRO, { url: URL_FUENTE, resumen: 'Otra vez.', categoria: 'Pruebas' }).catch((e: { codigo?: string; message?: string }) => e);
    marcar((repetida as { codigo?: string }).codigo === 'FUENTE_DUPLICADA', 'Paso 15c: la misma dirección no se repite', (repetida as { message?: string }).message ?? '');
    const ajena = await guardarFuenteWeb(OTRO, { url: 'https://example.com/x', resumen: 'Ajena.' }).catch((e: { codigo?: string }) => e);
    marcar((ajena as { codigo?: string }).codigo === 'FUENTE_URL_INVALIDA', 'Paso 15d: un enlace ajeno a Wikipedia se rechaza');
    const conVector = await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM fuentes_web WHERE usuario_id = $1 AND vector IS NOT NULL', [OTRO]);
    marcar(conVector.rows[0]?.n === 1, 'Paso 15e: la fuente queda con su vector de 768 dimensiones');
    const citada = await responderConFuentesWeb(OTRO, '¿Cada cuánto se cambia el filtro del purificador?');
    marcar(
      /nueve meses|9 meses/i.test(citada.respuesta) && citada.fuentes[0]?.url === URL_FUENTE && citada.fuentes[0]?.etiqueta === 'Prueba Nova purificador · Wikipedia',
      'Paso 15f: "Fuentes web" responde con la fuente y cita su enlace',
      `${citada.respuesta} | ${citada.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );
    const noEsta = await responderConFuentesWeb(OTRO, '¿Cuál es la capital de Mongolia?');
    marcar(noEsta.respuesta === SIN_RESPUESTA && noEsta.fuentes.length === 0, 'Paso 15g: lo que no está en las fuentes -> "No encontré"', noEsta.respuesta);
    const enWikipedia = await responderConWikipedia('qué es la fotosíntesis de las plantas');
    const antes = (await listarFuentesWeb(OTRO)).length;
    marcar(
      enWikipedia.fuentes.length > 0 && enWikipedia.fuentes.every((f) => f.tipo === 'web' && f.url?.startsWith('https://es.wikipedia.org/')) && antes === 1,
      'Paso 15h: Wikipedia responde con sus artículos y no guarda nada',
      enWikipedia.fuentes.map((f) => f.etiqueta).join(', '),
    );
    for (const f of await listarFuentesWeb(OTRO)) await eliminarFuenteWeb(OTRO, f.id);

    const ausente = await consultar(DUENO, '¿Cuál es la capital de Mongolia?');
    marcar(
      ausente.respuesta === SIN_RESPUESTA && ausente.fuentes.length === 0,
      'Paso 8: dato ausente',
      `${ausente.respuesta} | ${ausente.fuentes.length} fuentes`,
    );
  } catch (e) {
    marcar(false, 'Error inesperado', `${(e as { codigo?: string }).codigo ?? ''} ${(e as Error).message}`);
  } finally {
    // Solo se borra lo que creó esta ejecución.
    await sql.query('DELETE FROM tareas_personales WHERE id = ANY($1::uuid[])', [tareasCreadas]);
    await sql.query('DELETE FROM documentos WHERE id = ANY($1::uuid[])', [documentosCreados]);
    if (usuarioFuente) await sql.query('DELETE FROM fuentes_web WHERE usuario_id = $1', [usuarioFuente]);
    await sql.end();
    const { error } = await admin.auth.admin.deleteUser(OTRO);
    if (error) marcar(false, 'No se pudo borrar el usuario temporal', `${OTRO}: ${error.message}`);
    else console.log('Usuario temporal del paso 10 borrado');
    console.log(`Limpieza: ${tareasCreadas.length} tarea(s) y ${documentosCreados.length} documento(s) borrados`);
  }

  console.log(resumenEmbeddings());
  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

void main();
