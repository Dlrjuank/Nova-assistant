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
  indexarDocumento,
  listarDocumentos,
} from '@/lib/datos/documentos';
import { recuperarFragmentos } from '@/lib/datos/fragmentos';
import { completarTarea, crearTarea, eliminarTarea, hayTareasPendientes, listarTareas } from '@/lib/datos/tareas';
import { SIN_RESPUESTA } from '@/lib/llm/prompts';
import { hoyBogota } from '@/lib/reglas/fechas';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();

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
    // RB-30: SIN_DOCUMENTOS solo si la cuenta no tiene documentos ni tareas pendientes.
    if ((await existenDocumentos(DUENO)) || (await hayTareasPendientes(DUENO))) {
      console.log('OMITIDO paso 9: la cuenta ya tiene documentos o tareas pendientes, no se puede probar SIN_DOCUMENTOS');
    } else {
      const codigo = await codigoDe(() => consultar(DUENO, '¿Qué dice mi documento?'));
      marcar(codigo === 'SIN_DOCUMENTOS', 'Paso 9: consulta sin documentos', codigo);
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
    const sinDocs = await codigoDe(() => consultar(OTRO, '¿Qué dice mi documento?'));
    marcar(sinDocs === 'SIN_DOCUMENTOS', 'Paso 10d: otro usuario sin PDF propios -> SIN_DOCUMENTOS', sinDocs);
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
      soloPdf.respuesta === SIN_RESPUESTA && soloPdf.fuentes.length === 0,
      'Paso 11b: sin documentos, una pregunta de PDF -> mensaje exacto',
      `${soloPdf.respuesta} | ${soloPdf.fuentes.length} fuentes`,
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
      'Paso 10e: otro usuario no puede completar ni eliminar lo ajeno (como si no existiera)',
      ajenas.join(', '),
    );

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
    await sql.end();
    const { error } = await admin.auth.admin.deleteUser(OTRO);
    if (error) marcar(false, 'No se pudo borrar el usuario temporal', `${OTRO}: ${error.message}`);
    else console.log('Usuario temporal del paso 10 borrado');
    console.log(`Limpieza: ${tareasCreadas.length} tarea(s) y ${documentosCreados.length} documento(s) borrados`);
  }

  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

void main();
