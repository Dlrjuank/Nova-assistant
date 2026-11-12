// E10e: prueba los cuestionarios con Gemini real (plan 9.6). Ejecutar: npm run probar:cuestionario
// Usa un usuario temporal y un libro de prueba guardado directo en la base (sin embeddings: el cuestionario no los usa).
// Hace a lo sumo 2 llamadas de chat a Gemini. Al final borra todo lo que creó.
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { crearCuestionario, empezarIntento, obtenerCuestionario, responderPregunta } from '@/lib/datos/cuestionarios';
import { llm } from '@/lib/llm/gemini';
import { calcularPuntaje, formatearPuntaje, ubicarCita } from '@/lib/reglas/cuestionarios';
import { hoyBogota } from '@/lib/reglas/fechas';
import { etiquetaIncluye } from '@/lib/reglas/preguntasLibro';
import { fragmentarPaginas, inicioDePaginas } from '@/lib/reglas/libros';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();

let fallas = 0;
function marcar(ok: boolean, texto: string, detalle = ''): void {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}${detalle ? ` -> ${detalle}` : ''}`);
}

// Una isla inventada, para que el modelo no pueda responder con lo que ya sabe.
const LUGARES = ['el faro de Punta Cela', 'el puerto de Varela', 'la laguna Atuna', 'el mercado de Sorio', 'la escuela de Brena', 'el puente de Olmo', 'la torre de Quimel', 'el jardín de Tavira'];
const PERSONAS = ['Tomás Ibarra', 'Lucía Varga', 'Andrés Moll', 'Inés Caride', 'Rafael Soto', 'Elena Brun', 'Marcos Riel', 'Julia Peñas'];
const OFICIOS = ['pescadores de coral', 'tejedores de redes', 'cultivadores de cacao', 'constructores de barcas', 'apicultores del monte', 'salineros de la costa'];
function paginaDeIsla(n: number): string {
  const frases: string[] = [];
  for (let i = 0; i < 14; i++) {
    const k = n * 14 + i;
    const lugar = LUGARES[k % LUGARES.length] as string;
    const persona = PERSONAS[(k * 3) % PERSONAS.length] as string;
    const oficio = OFICIOS[(k * 5) % OFICIOS.length] as string;
    frases.push(
      `En la isla Marenta, ${lugar} fue ampliado en el año ${1790 + k * 7} por ${persona}, que trabajó ${k % 9 + 2} años con ${12 + k} ${oficio} y dejó escrito que la obra costó ${300 + k * 41} monedas de plata.`,
    );
  }
  return frases.join(' ');
}

async function main(): Promise<void> {
  const url = process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !supabaseUrl || !clave) throw new Error('Faltan variables de entorno de la base o de Supabase');
  const admin = createClient(supabaseUrl, clave, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: creado, error } = await admin.auth.admin.createUser({ email: `nova-cuestionario-${crypto.randomUUID()}@example.com`, password: `P-${crypto.randomUUID()}`, email_confirm: true });
  if (error || !creado.user) throw new Error(`No se pudo crear el usuario temporal: ${error?.message}`);
  const U = creado.user.id;
  const sql = new pg.Client(opcionesConexion(url));
  await sql.connect();

  // Cuenta las llamadas a Gemini, para comprobar que lo que no alcanza no gasta cuota (RB-49).
  let llamadas = 0;
  const original = llm.generarJson.bind(llm);
  llm.generarJson = async (d) => {
    llamadas += 1;
    return original(d);
  };

  try {
    const paginas = Array.from({ length: 6 }, (_, i) => paginaDeIsla(i));
    const fragmentos = fragmentarPaginas(paginas);
    const vector = `[${Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)).join(',')}]`;
    const { rows } = await sql.query<{ id: string }>(
      `INSERT INTO documentos (nombre_archivo, categoria, num_fragmentos, fecha_guardado, usuario_id, paginas, inicio_paginas)
       VALUES ('prueba-cuestionario.pdf', 'Pruebas', $1, $2, $3, $4, $5::int[]) RETURNING id`,
      [fragmentos.length, hoyBogota(), U, paginas.length, inicioDePaginas(paginas)],
    );
    const DOC = rows[0]?.id as string;
    for (const f of fragmentos) {
      await sql.query('INSERT INTO fragmentos_pdf (documento_id, numero, contenido, vector, pagina_inicio, pagina_fin, etiqueta_paginas) VALUES ($1, $2, $3, $4::vector, $5, $6, $7)', [
        DOC,
        f.numero,
        f.contenido,
        vector,
        f.paginaInicio,
        f.paginaFin,
        f.etiquetaPaginas,
      ]);
    }
    console.log(`Libro de prueba: ${paginas.length} páginas, ${fragmentos.length} fragmentos`);

    const insuficiente = await crearCuestionario(U, { documentoId: DOC, pedidas: 20, dificultad: 'media', alcance: 'paginas', desde: 3, hasta: 3 }).catch((e: { codigo?: string }) => e);
    marcar((insuficiente as { codigo?: string }).codigo === 'CONTENIDO_INSUFICIENTE' && llamadas === 0, 'Paso 1: 20 preguntas de una página no alcanzan y no llaman a Gemini (B-61)');
    const rango = await crearCuestionario(U, { documentoId: DOC, pedidas: 5, dificultad: 'media', alcance: 'paginas', desde: 4, hasta: 9 }).catch((e: Error) => e);
    marcar((rango as Error).message === 'El rango de páginas no es válido: este documento tiene 6 páginas.', 'Paso 2: un rango que no existe da el mensaje exacto');

    const inicio = Date.now();
    const nuevo = await crearCuestionario(U, { documentoId: DOC, pedidas: 5, dificultad: 'media', alcance: 'paginas', desde: 2, hasta: 4 });
    const segundos = Math.round((Date.now() - inicio) / 1000);
    marcar(nuevo.creadas >= 3 && llamadas <= 2, 'Paso 3: Gemini real crea el cuestionario con 2 llamadas como máximo', `${nuevo.creadas} de ${nuevo.pedidas} en ${segundos} s, ${llamadas} llamada(s)`);

    const { rows: guardadas } = await sql.query<{ enunciado: string; opciones: string[]; correcta: number; cita_textual: string; etiqueta_paginas: string }>(
      'SELECT enunciado, opciones, correcta, cita_textual, etiqueta_paginas FROM preguntas_cuestionario WHERE cuestionario_id = $1 ORDER BY orden',
      [nuevo.id],
    );
    const texto = paginas.join(' ');
    marcar(guardadas.every((p) => p.opciones.length === 4 && new Set(p.opciones).size === 4 && p.correcta >= 0 && p.correcta <= 3), 'Paso 4: cada pregunta tiene 4 opciones distintas y una correcta');
    marcar(guardadas.every((p) => ubicarCita(texto, p.cita_textual) !== null), 'Paso 5: cada cita aparece literal en el libro');
    marcar(
      guardadas.every((p) => p.etiqueta_paginas.split('–').every((n) => [2, 3, 4].some((x) => etiquetaIncluye(n, x)))),
      'Paso 6: las páginas citadas están dentro del alcance elegido (B-60)',
      guardadas.map((p) => p.etiqueta_paginas).join(', '),
    );
    const posiciones = new Set(guardadas.map((p) => p.correcta));
    console.log(`      Posiciones de la correcta tras barajar: ${guardadas.map((p) => p.correcta).join(', ')} (${posiciones.size} distintas)`);
    console.log(`      Ejemplo: ${guardadas[0]?.enunciado} | cita: «${guardadas[0]?.cita_textual}» | p. ${guardadas[0]?.etiqueta_paginas}`);

    const vista = await obtenerCuestionario(U, nuevo.id);
    marcar(vista.intento.preguntas.every((p) => p.respuesta === undefined) && !JSON.stringify(vista).includes('"correcta"'), 'Paso 7: antes de responder, la correcta no sale del servidor (RB-50)');

    // Acierta todas menos 2.
    const { rows: conCorrecta } = await sql.query<{ id: string; correcta: number }>('SELECT id, correcta FROM preguntas_cuestionario WHERE cuestionario_id = $1', [nuevo.id]);
    const correctaDe = new Map(conCorrecta.map((p) => [p.id, p.correcta]));
    const intentoId = vista.intento.id;
    let ultimo: Awaited<ReturnType<typeof responderPregunta>> | undefined;
    for (const [i, p] of vista.intento.preguntas.entries()) {
      const buena = correctaDe.get(p.id) as number;
      ultimo = await responderPregunta(U, intentoId, p.id, i < 2 ? (buena + 1) % 4 : buena);
    }
    const total = vista.intento.preguntas.length;
    const esperado = calcularPuntaje(total - 2, total);
    marcar(ultimo?.resultado?.puntaje === esperado, 'Paso 8: el puntaje sigue 7.11', `${total - 2} de ${total} -> ${formatearPuntaje(ultimo?.resultado?.puntaje ?? -1)}`);
    const otra = vista.intento.preguntas[0] as { id: string };
    const repetida = await responderPregunta(U, intentoId, otra.id, correctaDe.get(otra.id) as number);
    marcar(repetida.acierto === false, 'Paso 9: una respuesta no se cambia (RB-51)');

    const repaso = await empezarIntento(U, nuevo.id, intentoId);
    const vistaRepaso = await obtenerCuestionario(U, nuevo.id);
    marcar(vistaRepaso.intento.id === repaso.id && vistaRepaso.intento.repaso && vistaRepaso.intento.total === 2, 'Paso 10: "Repetir solo las que fallé" trae las 2 falladas (B-64)');
    let final: Awaited<ReturnType<typeof responderPregunta>> | undefined;
    for (const p of vistaRepaso.intento.preguntas) final = await responderPregunta(U, repaso.id, p.id, correctaDe.get(p.id) as number);
    marcar(final?.resultado?.puntaje === 500 && llamadas <= 2, 'Paso 11: el repaso se califica sobre sus propias preguntas, sin llamar a Gemini', formatearPuntaje(final?.resultado?.puntaje ?? -1));

    const ajeno = await obtenerCuestionario('00000000-0000-4000-8000-000000000000', nuevo.id).catch((e: { codigo?: string }) => e);
    marcar((ajeno as { codigo?: string }).codigo === 'CUESTIONARIO_NO_ENCONTRADO', 'Paso 12: otro usuario no ve el cuestionario');

    await sql.query('DELETE FROM documentos WHERE id = $1', [DOC]);
    const { rows: quedan } = await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM cuestionarios WHERE usuario_id = $1', [U]);
    marcar(quedan[0]?.n === 0, 'Paso 13: al eliminar el documento se borran sus cuestionarios');
  } catch (e) {
    marcar(false, 'Error inesperado', `${(e as { codigo?: string }).codigo ?? ''} ${(e as Error).message}`);
  } finally {
    await sql.query('DELETE FROM documentos WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.end();
    const { error: errorBorrar } = await admin.auth.admin.deleteUser(U);
    if (errorBorrar) marcar(false, 'No se pudo borrar el usuario temporal', errorBorrar.message);
    else console.log('Usuario temporal y libro de prueba borrados');
  }
  console.log(`Llamadas a Gemini: ${llamadas}`);
  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

void main();
