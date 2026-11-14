// E10e y E10g: prueba los cuestionarios con Gemini real (plan 9.6 y 9.7). Ejecutar: npm run probar:cuestionario
// Usa un usuario temporal y un libro de prueba guardado directo en la base (sin embeddings: el cuestionario no los usa).
// Hace a lo sumo 2 llamadas de chat a Gemini. Al final borra todo lo que creó.
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { autoevaluarPregunta, crearCuestionario, empezarIntento, obtenerCuestionario, responderPregunta } from '@/lib/datos/cuestionarios';
import { llm } from '@/lib/llm/gemini';
import { formatearPuntaje, ubicarCita } from '@/lib/reglas/cuestionarios';
import { armarFraseCompletar, HUECO, puntajeIntento, puntosMultiple, respuestaCompletarValida, TIPOS_PREGUNTA } from '@/lib/reglas/tiposPregunta';
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

interface FilaGuardada {
  id: string;
  tipo: string;
  enunciado: string;
  opciones: string[] | null;
  correcta: number | null;
  correctas: number[] | null;
  verdadero: boolean | null;
  respuesta_texto: string | null;
  cita_textual: string;
  etiqueta_paginas: string;
}

/** 9.7.2, repetido aquí para comprobar lo guardado. */
function validaSegunTipo(g: FilaGuardada): boolean {
  const cuatro = Array.isArray(g.opciones) && g.opciones.length === 4 && new Set(g.opciones).size === 4;
  switch (g.tipo) {
    case 'unica':
      return cuatro && g.correcta !== null && g.correcta >= 0 && g.correcta <= 3;
    case 'multiple':
      return cuatro && Array.isArray(g.correctas) && g.correctas.length >= 2 && g.correctas.length <= 3 && new Set(g.correctas).size === g.correctas.length;
    case 'vf':
      return typeof g.verdadero === 'boolean';
    case 'completar':
      return typeof g.respuesta_texto === 'string' && respuestaCompletarValida(g.respuesta_texto);
    case 'abierta':
      return typeof g.respuesta_texto === 'string' && g.respuesta_texto.length >= 20 && g.respuesta_texto.length <= 400;
    default:
      return false;
  }
}

async function vistaDe(usuario: string, cuestionario: string, pregunta: string) {
  return (await obtenerCuestionario(usuario, cuestionario)).intento.preguntas.find((q) => q.id === pregunta);
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

    // E10g (9.7): un cuestionario mixto de 5, con una sola ejecución (a lo sumo 2 llamadas).
    const inicio = Date.now();
    const nuevo = await crearCuestionario(U, { documentoId: DOC, pedidas: 5, dificultad: 'media', alcance: 'paginas', desde: 2, hasta: 4, tipo: 'mixto' });
    const segundos = Math.round((Date.now() - inicio) / 1000);
    marcar(nuevo.creadas >= 3 && llamadas <= 2, 'Paso 3: Gemini real crea el cuestionario mixto con 2 llamadas como máximo', `${nuevo.creadas} de ${nuevo.pedidas} en ${segundos} s, ${llamadas} llamada(s)`);

    const { rows: guardadas } = await sql.query<FilaGuardada>(
      'SELECT id, tipo, enunciado, opciones, correcta, correctas, verdadero, respuesta_texto, cita_textual, etiqueta_paginas FROM preguntas_cuestionario WHERE cuestionario_id = $1 ORDER BY orden',
      [nuevo.id],
    );
    const texto = paginas.join(' ');
    const tipos = guardadas.map((g) => g.tipo);
    const { rows: cuest } = await sql.query<{ tipo: string }>('SELECT tipo FROM cuestionarios WHERE id = $1', [nuevo.id]);
    marcar(
      cuest[0]?.tipo === 'mixto' && new Set(tipos).size === tipos.length && tipos.join() === TIPOS_PREGUNTA.filter((t) => tipos.includes(t)).join(),
      'Paso 4: mixto, como mucho una de cada tipo e intercaladas en su orden (RB-64)',
      tipos.join(', '),
    );
    marcar(guardadas.every(validaSegunTipo), 'Paso 5: cada pregunta pasa la validación de su tipo (9.7.2)');
    marcar(guardadas.every((g) => ubicarCita(texto, g.cita_textual) !== null), 'Paso 6: cada cita aparece literal en el libro');
    const completar = guardadas.find((g) => g.tipo === 'completar');
    marcar(
      !completar || (completar.enunciado.includes(HUECO) && armarFraseCompletar(completar.cita_textual, completar.respuesta_texto as string) === completar.enunciado),
      'Paso 7: la frase de completar la armó el servidor con la cita (RB-67)',
      completar ? `«${completar.enunciado}» → ${completar.respuesta_texto}` : 'sin pregunta de completar',
    );
    marcar(
      guardadas.every((g) => g.etiqueta_paginas.split('–').every((n) => [2, 3, 4].some((x) => etiquetaIncluye(n, x)))),
      'Paso 8: las páginas citadas están dentro del alcance elegido (B-60)',
      guardadas.map((g) => g.etiqueta_paginas).join(', '),
    );
    for (const g of guardadas) console.log(`      [${g.tipo}] ${g.enunciado}${g.respuesta_texto ? ` | respuesta: ${g.respuesta_texto}` : ''}${g.verdadero !== null ? ` | ${g.verdadero ? 'verdadera' : 'falsa'}` : ''}`);

    const vista = await obtenerCuestionario(U, nuevo.id);
    const json = JSON.stringify(vista.intento.preguntas);
    marcar(
      vista.intento.preguntas.every((q) => q.respuesta === undefined) && !/"correctas?"|"verdadero"|respuestaCorrecta|"cita"/.test(json) && guardadas.every((g) => !g.respuesta_texto || !json.includes(g.respuesta_texto)),
      'Paso 9: antes de responder no sale ninguna respuesta del servidor (RB-50)',
    );

    // Responde: la única mal, la múltiple con una correcta y una incorrecta, verdadero o falso bien, completar en
    // mayúsculas sin tildes y con espacios, y la abierta "A medias".
    const fila = new Map(guardadas.map((g) => [g.id, g]));
    const intentoId = vista.intento.id;
    const esperados: number[] = [];
    let ultimo: Awaited<ReturnType<typeof responderPregunta>> | undefined;
    for (const q of vista.intento.preguntas) {
      const g = fila.get(q.id) as FilaGuardada;
      if (g.tipo === 'unica') {
        ultimo = await responderPregunta(U, intentoId, q.id, { elegida: ((g.correcta as number) + 1) % 4 });
        esperados.push(0);
      } else if (g.tipo === 'multiple') {
        const correctas = g.correctas as number[];
        const mala = [0, 1, 2, 3].find((i) => !correctas.includes(i)) as number;
        ultimo = await responderPregunta(U, intentoId, q.id, { elegidas: [correctas[0] as number, mala] });
        esperados.push(puntosMultiple(correctas, [correctas[0] as number, mala]));
      } else if (g.tipo === 'vf') {
        ultimo = await responderPregunta(U, intentoId, q.id, { verdadero: g.verdadero as boolean });
        esperados.push(100);
      } else if (g.tipo === 'completar') {
        const escrita = `  ${(g.respuesta_texto as string).normalize('NFD').replace(/[\u0301\u0308]/g, '').toUpperCase()}   `;
        ultimo = await responderPregunta(U, intentoId, q.id, { texto: escrita });
        marcar(ultimo.puntos === 100, 'Paso 10: completar acierta en mayúsculas, sin tildes y con espacios de más (7.13)', escrita.trim());
        esperados.push(100);
      } else {
        const enviada = await responderPregunta(U, intentoId, q.id, { texto: 'Mi respuesta con mis propias palabras.' });
        marcar(enviada.puntos === null && enviada.respuestaCorrecta === g.respuesta_texto && !enviada.resultado, 'Paso 11: la abierta enviada muestra la respuesta modelo y espera la autoevaluación (RB-68)');
        const otraVez = await vistaDe(U, nuevo.id, q.id);
        marcar(otraVez?.respuesta?.respuestaCorrecta === g.respuesta_texto && otraVez.respuesta.puntos === null, 'Paso 12: al volver, la abierta sigue con la respuesta modelo y sin calificar (B-80)');
        ultimo = await autoevaluarPregunta(U, intentoId, q.id, 'medias');
        const repetida = await autoevaluarPregunta(U, intentoId, q.id, 'bien');
        marcar(repetida.puntos === 50 && repetida.autoevaluacion === 'medias', 'Paso 13: la calificación no se cambia');
        esperados.push(50);
      }
    }
    // El resultado llega con la última que completa el intento; si la abierta no fue la última, puede llegar antes.
    const final = (await obtenerCuestionario(U, nuevo.id)).intento;
    const puntajeEsperado = puntajeIntento(esperados, esperados.length);
    marcar(final.terminado && final.puntaje === puntajeEsperado && (ultimo?.resultado === undefined || ultimo.resultado.puntaje === puntajeEsperado), 'Paso 14: el puntaje sigue 7.12', `${esperados.join(' + ')} -> ${formatearPuntaje(final.puntaje ?? -1)}`);
    const unica = vista.intento.preguntas.find((q) => q.tipo === 'unica');
    if (unica) {
      const repetida = await responderPregunta(U, intentoId, unica.id, { elegida: fila.get(unica.id)?.correcta as number });
      marcar(repetida.acierto === false, 'Paso 15: una respuesta no se cambia (RB-51)');
    }
    const otroTipo = await responderPregunta(U, intentoId, (vista.intento.preguntas[0] as { id: string }).id, { texto: 'x'.repeat(5) }).catch((e: { codigo?: string }) => e);
    marcar(vista.intento.preguntas[0]?.tipo === 'completar' || vista.intento.preguntas[0]?.tipo === 'abierta' || (otroTipo as { codigo?: string }).codigo === 'DATOS_INVALIDOS', 'Paso 16: una respuesta de otro tipo se rechaza (RB-69)');

    const falladas = esperados.filter((e) => e < 100).length;
    const repaso = await empezarIntento(U, nuevo.id, intentoId);
    const vistaRepaso = await obtenerCuestionario(U, nuevo.id);
    marcar(vistaRepaso.intento.id === repaso.id && vistaRepaso.intento.repaso && vistaRepaso.intento.total === falladas, 'Paso 17: "Repetir solo las que fallé" trae las de menos de 1 punto, también las parciales y "A medias"', `${falladas} falladas`);
    for (const q of vistaRepaso.intento.preguntas) {
      const g = fila.get(q.id) as FilaGuardada;
      if (g.tipo === 'unica') await responderPregunta(U, repaso.id, q.id, { elegida: g.correcta as number });
      else if (g.tipo === 'multiple') await responderPregunta(U, repaso.id, q.id, { elegidas: g.correctas as number[] });
      else if (g.tipo === 'vf') await responderPregunta(U, repaso.id, q.id, { verdadero: g.verdadero as boolean });
      else if (g.tipo === 'completar') await responderPregunta(U, repaso.id, q.id, { texto: g.respuesta_texto as string });
      else {
        await responderPregunta(U, repaso.id, q.id, { texto: 'Ahora sí.' });
        await autoevaluarPregunta(U, repaso.id, q.id, 'bien');
      }
    }
    const repasado = (await obtenerCuestionario(U, nuevo.id)).intento;
    marcar(repasado.puntaje === 500 && llamadas <= 2, 'Paso 18: el repaso se califica sobre sus propias preguntas, sin llamar a Gemini', formatearPuntaje(repasado.puntaje ?? -1));

    const ajeno = await obtenerCuestionario('00000000-0000-4000-8000-000000000000', nuevo.id).catch((e: { codigo?: string }) => e);
    marcar((ajeno as { codigo?: string }).codigo === 'CUESTIONARIO_NO_ENCONTRADO', 'Paso 19: otro usuario no ve el cuestionario');

    await sql.query('DELETE FROM documentos WHERE id = $1', [DOC]);
    const { rows: quedan } = await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM cuestionarios WHERE usuario_id = $1', [U]);
    marcar(quedan[0]?.n === 0, 'Paso 20: al eliminar el documento se borran sus cuestionarios');
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
