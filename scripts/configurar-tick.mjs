// E11c (6.12): guarda en Supabase Vault lo que necesita el aviso de cada minuto (pg_cron + pg_net, M16):
// la dirección de POST /api/nova/recordatorios/tick, el secreto que esa ruta exige y la omisión de la protección de
// Vercel (solo mientras apunte a la vista previa). Lee los valores de .env.local y nunca los imprime.
//   npm run db:configurar-tick              guarda o actualiza los tres
//   npm run db:configurar-tick -- --quitar  borra los tres: el aviso deja de llamar (pg_cron sigue, sin hacer nada)
import pg from 'pg';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();
const url = process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING;
const SECRETOS = [
  ['nova_tick_url', 'NOVA_TICK_URL', 'Dirección del aviso de cada minuto (E11c)'],
  ['nova_tick_secreto', 'RECORDATORIOS_SECRETO', 'Secreto de x-nova-tick (E11c)'],
  ['nova_tick_omision_vercel', 'VERCEL_AUTOMATION_BYPASS_SECRET', 'Omisión de la protección de Vercel para la vista previa (E11c)'],
];
const quitar = process.argv.includes('--quitar');

if (!url) {
  console.error('Falta NOVAASSISTANT_POSTGRES_URL_NON_POOLING');
  process.exit(1);
}
const faltan = SECRETOS.filter(([, variable]) => variable !== 'VERCEL_AUTOMATION_BYPASS_SECRET' && !process.env[variable]).map(([, v]) => v);
if (!quitar && faltan.length > 0) {
  console.error(`Faltan en .env.local: ${faltan.join(', ')}`);
  process.exit(1);
}

const c = new pg.Client(opcionesConexion(url));
await c.connect();
try {
  for (const [nombre, variable, descripcion] of SECRETOS) {
    const actual = (await c.query('SELECT id FROM vault.secrets WHERE name = $1', [nombre])).rows[0];
    const valor = process.env[variable];
    if (quitar || !valor) {
      if (actual) await c.query('DELETE FROM vault.secrets WHERE id = $1', [actual.id]);
      console.log(`${nombre}: ${actual ? 'borrado' : 'no estaba'}`);
    } else if (actual) {
      await c.query('SELECT vault.update_secret($1, $2, $3, $4)', [actual.id, valor, nombre, descripcion]);
      console.log(`${nombre}: actualizado`);
    } else {
      await c.query('SELECT vault.create_secret($1, $2, $3)', [valor, nombre, descripcion]);
      console.log(`${nombre}: guardado`);
    }
  }
  const job = (await c.query("SELECT schedule, active FROM cron.job WHERE jobname = 'nova-recordatorios'")).rows[0];
  console.log(job ? `pg_cron: nova-recordatorios ${job.schedule} (${job.active ? 'activo' : 'inactivo'})` : 'pg_cron: falta el aviso (¿M16 aplicada?)');
} finally {
  await c.end();
}
