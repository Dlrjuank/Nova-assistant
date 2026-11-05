// Prueba el flujo RAG completo contra la base y Gemini (plan, sección 17.2). Ejecutar: npm run probar:rag
// Importa de lib/datos y no de dataService, que usa 'server-only' y solo carga dentro de Next.
// Para verificar y limpiar usa su propio cliente pg, como los demás scripts: solo lib/datos importa conexion.ts.
import { head, put } from '@vercel/blob';
import pg from 'pg';
import { consultar } from '@/lib/datos/consulta';
import { emitirTokenSubida, existenDocumentos, indexarDocumento } from '@/lib/datos/documentos';
import { crearTarea } from '@/lib/datos/tareas';
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

async function main(): Promise<void> {
  const sql = new pg.Client(opcionesConexion(process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING as string));
  await sql.connect();
  const tareasCreadas: string[] = [];
  const documentosCreados: string[] = [];

  try {
    if (await existenDocumentos()) {
      console.log('OMITIDO paso 9: ya hay documentos en la base, no se puede probar SIN_DOCUMENTOS');
    } else {
      const codigo = await codigoDe(() => consultar('¿Qué dice mi documento?'));
      marcar(codigo === 'SIN_DOCUMENTOS', 'Paso 9: consulta sin documentos', codigo);
    }

    const tarea = await crearTarea({
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
      crearTarea({ titulo: 'Prueba prioridad', prioridad: 7, fechaLimite: '2099-01-15' }),
    );
    marcar(prioridad === 'PRIORIDAD_INVALIDA', 'Paso 2: prioridad 7', prioridad);

    const fecha = await codigoDe(() => crearTarea({ titulo: 'Prueba fecha', fechaLimite: '2026-02-30' }));
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

    const { documentoId, numFragmentos } = await indexarDocumento({ urlBlob, nombreArchivo: NOMBRE_PDF });
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

    const corta = await codigoDe(() => consultar('info'));
    marcar(corta === 'CONSULTA_MUY_CORTA', 'Paso 5: consulta "info"', corta);

    const dato = await consultar('¿Cuántos meses dura la garantía del purificador?');
    marcar(
      dato.respuesta.includes('24') && dato.fuentes.some((f) => f.tipo === 'pdf' && f.etiqueta.includes(NOMBRE_PDF)),
      'Paso 6: dato presente en el PDF',
      `${dato.respuesta} | fuentes: ${dato.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );

    // RN-21: la pregunta de seguimiento solo se entiende con la anterior.
    const primera = '¿Cuáles son los pasos para cambiar el filtro?';
    const pasos = await consultar(primera);
    const seguimiento = await consultar('¿y el segundo?', [
      { autor: 'usuario', texto: primera },
      { autor: 'asistente', texto: pasos.respuesta },
    ]);
    marcar(
      /gira/i.test(seguimiento.respuesta) && seguimiento.respuesta !== SIN_RESPUESTA,
      'Paso 6b: seguimiento "¿y el segundo?" con el historial',
      `${seguimiento.respuesta} | fuentes: ${seguimiento.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );

    const pendientes = await consultar('¿Qué tareas tengo pendientes?');
    marcar(
      /pasaporte/i.test(pendientes.respuesta) && pendientes.fuentes.some((f) => f.tipo === 'tarea'),
      'Paso 7: tareas pendientes',
      `${pendientes.respuesta} | fuentes: ${pendientes.fuentes.map((f) => f.etiqueta).join(', ')}`,
    );

    const ausente = await consultar('¿Cuál es la capital de Mongolia?');
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
    console.log(`Limpieza: ${tareasCreadas.length} tarea(s) y ${documentosCreados.length} documento(s) borrados`);
  }

  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

void main();
