// Comprueba E10b contra la base y Gemini reales con un libro de prueba: páginas, capítulos e indexación por partes.
// Crea un usuario temporal y lo borra al final, con todo lo suyo. Uso: npm run probar:libro
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { consultarYRegistrar, explicarRespuesta } from '@/lib/datos/conversacion';
import { capitulosDeDocumento, continuarIndexacion, indexarContenido, listarDocumentos } from '@/lib/datos/documentos';
import { recuperarFragmentos } from '@/lib/datos/fragmentos';
import { llm } from '@/lib/llm/gemini';
import { etiquetaFragmento } from '@/lib/llm/prompts';
import { extraerPdf } from '@/lib/pdf/extraer';
import { detectarCapitulos } from '@/lib/reglas/libros';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';
import { generarLibroPdf, libroDeEjemplo } from './pdf-libro';

cargarEnv();

async function main() {
let fallas = 0;
const marcar = (ok: boolean, texto: string) => {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}`);
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) throw new Error('Faltan las variables de Supabase');
const admin = createClient(url, clave, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.createUser({ email: `probar-libro-${randomUUID()}@example.com`, password: `P-${randomUUID()}`, email_confirm: true });
if (error || !data.user) throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
const U = data.user.id;
const sql = new pg.Client(opcionesConexion(process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING as string));
await sql.connect();

try {
  // 1) Extracción real.
  const libro = libroDeEjemplo();
  const extraido = await extraerPdf(libro.slice()); // pdf.js vacía el búfer que recibe
  marcar(extraido.paginas.length === 40, `Paso 1: 40 páginas extraídas (${extraido.paginas.length})`);
  marcar(extraido.etiquetas?.[0] === 'i' && extraido.etiquetas?.[2] === '1', `Paso 1b: números impresos (${extraido.etiquetas?.slice(0, 3).join(', ')})`);
  marcar(extraido.indice.length === 7, `Paso 1c: índice interno (${extraido.indice.length} entradas)`);

  // 2) Primera parte: un solo lote y se detiene.
  const primera = await indexarContenido(U, libro, { nombreArchivo: 'prueba-libro.pdf' }, { presupuestoMs: 1 });
  const id = primera.documentoId;
  marcar(primera.progreso !== null && primera.progreso > 0 && primera.progreso < 100, `Paso 2: indexó una parte (${primera.progreso} %) de ${primera.numFragmentos} fragmentos`);
  const lista = await listarDocumentos(U);
  marcar(lista[0]?.progreso === primera.progreso && lista[0]?.paginas === 40 && lista[0]?.numFragmentos === 0, 'Paso 2b: la lista lo muestra indexando');
  const vector = await llm.generarEmbedding('¿Qué explica el capítulo de las células?');
  marcar((await recuperarFragmentos(U, vector, 4)).length === 0, 'Paso 2c: a medias no entra en las búsquedas (RB-38)');

  // 3) Dos llamadas a la vez: la segunda no repite el trabajo; y reanudar hasta el final.
  await sql.query("UPDATE documentos SET indexando_hasta = NOW() + interval '1 minute' WHERE id = $1", [id]);
  const ocupado = await continuarIndexacion(U, id, { presupuestoMs: 1 });
  marcar(ocupado.ocupado === true, 'Paso 3: con otra llamada en curso responde "ocupado"');
  await sql.query('UPDATE documentos SET indexando_hasta = NULL WHERE id = $1', [id]);
  let progreso: number | null = primera.progreso;
  for (let vueltas = 0; progreso !== null && vueltas < 10; vueltas++) ({ progreso } = await continuarIndexacion(U, id));
  marcar(progreso === null, 'Paso 3b: reanudó hasta terminar');
  const { rows: [doc] } = await sql.query('SELECT num_fragmentos, progreso, por_indexar, indexando_hasta, (SELECT count(*)::int FROM fragmentos_pdf WHERE documento_id = d.id) AS guardados FROM documentos d WHERE id = $1', [id]);
  marcar(doc.num_fragmentos === primera.numFragmentos && doc.guardados === primera.numFragmentos && doc.progreso === null && doc.por_indexar === null && doc.indexando_hasta === null, `Paso 3c: ${doc.guardados} fragmentos, sin repetir ni pendientes`);

  // 4) Páginas y citas.
  const { rows: filas } = await sql.query('SELECT contenido, pagina_inicio, pagina_fin, etiqueta_paginas FROM fragmentos_pdf WHERE documento_id = $1 ORDER BY numero', [id]);
  const conMarca = filas.find((f) => f.contenido.includes('PAGINA-10.'));
  marcar(Boolean(conMarca) && conMarca.pagina_inicio <= 12 && conMarca.pagina_fin >= 12 && conMarca.etiqueta_paginas.includes('10'), `Paso 4: la página impresa 10 (PDF 12) está en ${conMarca?.etiqueta_paginas}`);
  marcar(filas.every((f) => f.pagina_inicio !== null && f.pagina_fin >= f.pagina_inicio), 'Paso 4b: todos los fragmentos tienen páginas');
  const hallados = await recuperarFragmentos(U, vector, 4);
  marcar(hallados.length === 4 && hallados.every((f) => /prueba-libro\.pdf · pp?\. /.test(etiquetaFragmento(f))), `Paso 4c: la búsqueda cita páginas (${etiquetaFragmento(hallados[0] as never)})`);

  // 5) Capítulos.
  const { capitulos } = await capitulosDeDocumento(U, id);
  const cap = capitulos.filter((c) => c.nivel === 1);
  marcar(cap.length === 4 && capitulos.length === 7, `Paso 5: ${cap.length} capítulos y ${capitulos.length - cap.length} secciones`);
  marcar(cap[0]?.etiquetaPaginas === '1–10' && cap[3]?.etiquetaPaginas === '29–38', `Paso 5b: páginas impresas (${cap.map((c) => c.etiquetaPaginas).join(', ')})`);

  // 5c) E10c: preguntas reales por página y capítulo, y "Más simple".
  const pagina = await consultarYRegistrar(U, '¿Qué dice la página 10?', undefined, id);
  marcar(pagina.fuentes.some((f) => /p+\. .*10/.test(f.etiqueta)) && pagina.explicable === true, `Paso 5c: pregunta por página citando ${pagina.fuentes.map((f) => f.etiqueta).join(', ')}`);
  const fuera = await consultarYRegistrar(U, '¿Qué dice la página 500?', undefined, id);
  marcar(fuera.respuesta === 'Ese documento tiene 40 páginas.', `Paso 5d: página inexistente: ${fuera.respuesta}`);
  const capitulo = await consultarYRegistrar(U, 'Resume el capítulo 3', undefined, id);
  marcar(capitulo.fuentes[0]?.etiqueta === 'prueba-libro.pdf · pp. 20–28' && capitulo.respuesta.length > 40, `Paso 5e: capítulo citando ${capitulo.fuentes[0]?.etiqueta}`);
  const citasCap = [...capitulo.respuesta.matchAll(/\[pp?\. ([^\]]+)\]/g)].map((m) => m[1] as string);
  const dentro = citasCap.every((c) => c.split('–').every((n) => Number(n) >= 20 && Number(n) <= 28));
  marcar(!/,\s*,|\s[,.;]\s|\(\s*\)/.test(capitulo.respuesta) && !capitulo.respuesta.includes('prueba-libro.pdf') && citasCap.length > 0 && dentro, `Paso 5e2: citas cortas y dentro del capítulo (${citasCap.join(', ')})`);
  const simple = await explicarRespuesta(U, pagina.mensajeId as number, 'simple');
  marcar(simple.fuentes.map((f) => f.etiqueta).join() === pagina.fuentes.map((f) => f.etiqueta).join() && simple.respuesta !== pagina.respuesta && simple.guardada, 'Paso 5f: "Más simple" responde con las mismas citas');

  // 6) Sin índice interno: encabezados. Solo extracción y reglas, sin gastar más cuota.
  const sinIndice = generarLibroPdf({ paginas: [['Portada'], ['Capítulo 1', 'Primeros pasos', 'Texto.'], ['Más texto.'], ['Capítulo 2: Segundo paso', 'Texto.']] });
  const leido = await extraerPdf(sinIndice);
  const porEncabezado = detectarCapitulos(leido.paginas, leido.indice, leido.etiquetas);
  marcar(porEncabezado.map((c) => c.titulo).join(' | ') === 'Capítulo 1: Primeros pasos | Capítulo 2: Segundo paso', `Paso 6: encabezados como respaldo (${porEncabezado.map((c) => `${c.titulo} ${c.etiquetaPaginas}`).join(' | ')})`);
} catch (e) {
  fallas++;
  console.error('Error inesperado:', e);
} finally {
  await sql.end().catch(() => {});
  await admin.auth.admin.deleteUser(U);
  console.log('usuario temporal y sus documentos borrados');
}
console.log(`Fallas: ${fallas}`);
process.exit(fallas ? 1 : 0);
}

void main();
