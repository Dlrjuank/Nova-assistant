// E20c-1 (PLAN_AMPLIACION 11.2, S-81 a S-84 contra la base y Google reales): la clave de Gemini propia.
// Con un usuario temporal: una clave inventada se rechaza sin guardar nada; GEMINI_API_KEY vinculada como si fuera
// de esa persona se verifica con models.get (sin gastar cuota de generación) y queda solo cifrada; se descifra con
// su usuario y no con otro; una pregunta corta usa esa clave (una sola llamada de generación); sin clave, la IA no
// se usa; desvincular la borra. Al final borra el usuario temporal y todo lo suyo. Uso: npm run probar:clave
// Nunca imprime una clave.
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { desvincularClaveGemini, estadoIa, guardarClaveGemini, infoClaveGemini, olvidarClaveEnMemoria, resolverClave } from '@/lib/datos/claveGemini';
import { descifrarClave } from '@/lib/ia/cifrado';
import { conIaDe } from '@/lib/llm/contextoIa';
import { llm } from '@/lib/llm/gemini';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();

async function main(): Promise<void> {
  let fallas = 0;
  const marcar = (ok: boolean, texto: string, detalle = '') => {
    if (!ok) fallas++;
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}${detalle ? ` -> ${detalle}` : ''}`);
  };
  const claveReal = process.env.GEMINI_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL;
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servicio || !claveReal) throw new Error('Faltan variables de entorno (Supabase o GEMINI_API_KEY)');
  const admin = createClient(url, servicio, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email: `probar-clave-${randomUUID()}@example.com`, password: `P-${randomUUID()}`, email_confirm: true });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  const U = data.user.id;
  const OTRO = randomUUID();
  const sql = new pg.Client(opcionesConexion(process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING as string));
  await sql.connect();
  const codigoDe = (p: Promise<unknown>) => p.then(() => 'ninguno', (e: { codigo?: string }) => e.codigo ?? 'otro');
  const fila = async () => (await sql.query('SELECT * FROM claves_gemini WHERE usuario_id = $1', [U])).rows[0] as Record<string, unknown> | undefined;

  try {
    // Paso 1: sin clave y sin ser el dueño, la IA no se usa (RB-79) y no se llama a Gemini.
    marcar((await estadoIa(U)) === 'sin_clave', 'Paso 1: cuenta nueva sin clave → estado sin_clave');
    marcar((await codigoDe(conIaDe(U, () => llm.responder({ sistema: 's', contexto: '', pregunta: 'hola' })))) === 'SIN_CLAVE_GEMINI', 'Paso 1: la IA responde SIN_CLAVE_GEMINI antes de llamar a Gemini');

    // Paso 2: una clave inventada se rechaza y no se guarda nada (RB-77).
    const inventada = `AIza${randomUUID().replace(/-/g, '')}xx`;
    marcar((await codigoDe(guardarClaveGemini(U, inventada))) === 'CLAVE_GEMINI_INVALIDA', 'Paso 2: Google no acepta una clave inventada');
    marcar((await fila()) === undefined, 'Paso 2: no quedó nada guardado');

    // Paso 3: una clave real se verifica (models.get) y se guarda solo cifrada.
    const guardada = await guardarClaveGemini(U, claveReal);
    marcar(guardada.estado === 'activa' || guardada.estado === 'sin_cuota', `Paso 3: verificada y guardada (${guardada.estado})`);
    const f = await fila();
    const columnas = JSON.stringify(Object.values(f ?? {}).map((v) => (Buffer.isBuffer(v) ? v.toString('latin1') : String(v))));
    marcar(Boolean(f) && !columnas.includes(claveReal) && f?.ultimos4 === claveReal.slice(-4), 'Paso 3: en la base solo está cifrada (y los últimos 4)');
    const info = await infoClaveGemini(U);
    marcar(!JSON.stringify(info).includes(claveReal) && info.ultimos4 === claveReal.slice(-4), 'Paso 3: lo que ve la pantalla no lleva la clave');

    // Paso 4: se descifra con su usuario y no con otro (S-81).
    const c = { cifrada: f?.cifrada as Buffer, iv: f?.iv as Buffer, etiqueta: f?.etiqueta as Buffer, version: Number(f?.version_llave) };
    marcar(descifrarClave(c, U) === claveReal, 'Paso 4: se descifra con su usuario');
    let otro = 'se pudo';
    try {
      descifrarClave(c, OTRO);
    } catch {
      otro = 'no se pudo';
    }
    marcar(otro === 'no se pudo', 'Paso 4: con otro usuario no se descifra');

    // Paso 5: una pregunta corta usa esa clave (una sola llamada) y queda contada en uso_ia_diario.
    olvidarClaveEnMemoria(U);
    marcar((await resolverClave(U)).origen === 'propia', 'Paso 5: la IA de esta persona usa su propia clave');
    const respuesta = await conIaDe(U, () => llm.responder({ sistema: 'Responde con una sola palabra.', contexto: '', pregunta: '¿De qué color es el cielo despejado?' }));
    marcar(respuesta.length > 0, 'Paso 5: Gemini respondió con la clave de la persona', respuesta.slice(0, 40));
    const uso = (await sql.query('SELECT consultas FROM uso_ia_diario WHERE usuario_id = $1', [U])).rows[0] as { consultas: number } | undefined;
    marcar((uso?.consultas ?? 0) >= 1, `Paso 5: uso_ia_diario contó ${uso?.consultas ?? 0} consulta(s), sin el texto`);

    // Paso 5b: cambiar la llave (simulacro): con una V2 nueva como actual, claves:recifrar la pasaría sin perderla.
    const salida = execSync('npx tsx scripts/recifrar-claves.ts --probar', {
      env: { ...process.env, NOVA_LLAVE_CLAVES_V2: randomBytes(32).toString('base64'), NOVA_LLAVE_CLAVES_ACTUAL: '2' },
      encoding: 'utf8',
    });
    marcar(/Recifradas: [1-9]/.test(salida) && /Ilegibles: 0/.test(salida) && /no se cambió nada/.test(salida) && !salida.includes(claveReal), 'Paso 5b: con una llave nueva, claves:recifrar la vuelve a cifrar (simulacro, sin cambiar nada)', salida.trim().split(/\r?\n/)[0]);
    marcar(Number((await fila())?.version_llave) === 1, 'Paso 5b: tras el simulacro la clave sigue con la versión 1');

    // Paso 6: desvincular la borra y la IA vuelve a pedir la clave (RB-80).
    await desvincularClaveGemini(U);
    marcar((await fila()) === undefined && (await estadoIa(U)) === 'sin_clave', 'Paso 6: desvinculada: no queda en la base y vuelve a sin_clave');
  } catch (e) {
    marcar(false, 'Error inesperado', `${(e as { codigo?: string }).codigo ?? ''} ${(e as Error).message}`.replace(claveReal, '[clave oculta]'));
  } finally {
    await sql.query('DELETE FROM claves_gemini WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.query('DELETE FROM uso_ia_diario WHERE usuario_id = $1', [U]).catch(() => {});
    await sql.end();
    const { error: errorBorrar } = await admin.auth.admin.deleteUser(U);
    if (errorBorrar) marcar(false, 'No se pudo borrar el usuario temporal', errorBorrar.message);
    else console.log('Usuario temporal borrado con su clave y su uso');
  }
  console.log(`\nTotal de fallas: ${fallas}`);
  process.exit(fallas ? 1 : 0);
}

void main();
