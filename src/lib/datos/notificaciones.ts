import webpush from 'web-push';
import { conTransaccion, consultar } from '@/lib/db/conexion';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { hoyBogota } from '@/lib/reglas/fechas';
import type { FormatoHora } from '@/lib/reglas/preferencias';
import { decisionEnvio, rutaDeTarea, textoNotificacion, type Recordatorio } from '@/lib/reglas/recordatorios';

/**
 * E11c (PLAN_AMPLIACION 5.10, 6.12, 7.10; RB-44, RB-45): notificaciones push. Las claves VAPID viven en las
 * variables de entorno (nunca en el repositorio). El sujeto es la dirección de la app, no un correo.
 */

export interface CargaNotificacion {
  titulo: string;
  cuerpo: string;
  /** La pantalla que abre al tocarla. */
  url: string;
  /** Agrupa: una notificación nueva de la misma tarea reemplaza a la anterior. */
  etiqueta: string;
}

export interface SuscripcionEntrada {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  dispositivo?: string | undefined;
}

const SUJETO_POR_DEFECTO = 'https://nova-assistantsm-kappa.vercel.app';
/** Si el teléfono está apagado, el aviso espera como máximo esto; después ya no sirve (la ventana de 7.10). */
const VIGENCIA_SEGUNDOS = 30 * 60;

let configurado = false;
function configurar(): boolean {
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return false;
  if (!configurado) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || SUJETO_POR_DEFECTO, publica, privada);
    configurado = true;
  }
  return true;
}

/** La clave pública que el navegador necesita para suscribirse, o null si el servidor no tiene claves. */
export function clavePublicaPush(): string | null {
  return configurar() ? (process.env.VAPID_PUBLIC_KEY as string) : null;
}

/** Guarda (o renueva) la suscripción de este dispositivo. Si el dispositivo era de otro usuario, pasa a este. */
export async function guardarSuscripcion(usuarioId: string, s: SuscripcionEntrada): Promise<{ suscripciones: number }> {
  if (!s.endpoint.startsWith('https://') || !s.keys.p256dh || !s.keys.auth) throw new ErrorDeNegocio('SUSCRIPCION_INVALIDA');
  await consultar(
    `INSERT INTO suscripciones_push (usuario_id, endpoint, p256dh, auth, dispositivo) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
       dispositivo = EXCLUDED.dispositivo, ultimo_error = NULL`,
    [usuarioId, s.endpoint, s.keys.p256dh, s.keys.auth, (s.dispositivo ?? '').slice(0, 120)],
  );
  return { suscripciones: await contarSuscripciones(usuarioId) };
}

/** Quita la suscripción de este dispositivo (solo si es del usuario). */
export async function borrarSuscripcion(usuarioId: string, endpoint: string): Promise<{ suscripciones: number }> {
  await consultar('DELETE FROM suscripciones_push WHERE usuario_id = $1 AND endpoint = $2', [usuarioId, endpoint]);
  return { suscripciones: await contarSuscripciones(usuarioId) };
}

export async function contarSuscripciones(usuarioId: string): Promise<number> {
  const [fila] = await consultar<{ n: number }>('SELECT count(*)::int AS n FROM suscripciones_push WHERE usuario_id = $1', [usuarioId]);
  return fila?.n ?? 0;
}

/**
 * Envía a todos los dispositivos del usuario. Una suscripción vencida (404 o 410) se borra; otro error queda
 * anotado en `ultimo_error`.
 */
export async function enviarAUsuario(usuarioId: string, carga: CargaNotificacion): Promise<{ enviadas: number; fallidas: number }> {
  if (!configurar()) throw new ErrorDeNegocio('NOTIFICACIONES_NO_CONFIGURADAS');
  const suscripciones = await consultar<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    'SELECT id, endpoint, p256dh, auth FROM suscripciones_push WHERE usuario_id = $1',
    [usuarioId],
  );
  let enviadas = 0;
  let fallidas = 0;
  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(carga), {
          TTL: VIGENCIA_SEGUNDOS,
          urgency: 'high',
          topic: carga.etiqueta.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32),
        });
        enviadas++;
      } catch (error) {
        fallidas++;
        const estado = (error as { statusCode?: number }).statusCode;
        if (estado === 404 || estado === 410) {
          await consultar('DELETE FROM suscripciones_push WHERE id = $1', [s.id]);
        } else {
          const texto = `${estado ?? ''} ${error instanceof Error ? error.message : String(error)}`.trim().slice(0, 300);
          await consultar('UPDATE suscripciones_push SET ultimo_error = $2 WHERE id = $1', [s.id, texto]);
        }
      }
    }),
  );
  return { enviadas, fallidas };
}

async function registrarEnvio(usuarioId: string, tipo: 'recordatorio' | 'prueba', tareaId: string | null, resultado: string): Promise<void> {
  await consultar('INSERT INTO envios (usuario_id, tarea_id, tipo, fecha, resultado) VALUES ($1, $2, $3, $4, $5)', [
    usuarioId,
    tareaId,
    tipo,
    hoyBogota(),
    resultado.slice(0, 200),
  ]);
}

/** B-56: "Enviar una de prueba" a todos los dispositivos del usuario. */
export async function enviarPrueba(usuarioId: string): Promise<{ enviadas: number; fallidas: number }> {
  if (!configurar()) throw new ErrorDeNegocio('NOTIFICACIONES_NO_CONFIGURADAS');
  if ((await contarSuscripciones(usuarioId)) === 0) throw new ErrorDeNegocio('SIN_NOTIFICACIONES');
  const r = await enviarAUsuario(usuarioId, {
    titulo: 'Nova',
    cuerpo: 'Así te llegarán los recordatorios de tus tareas.',
    url: '/nova/configuracion',
    // Una etiqueta nueva cada vez: en Windows, una notificación que reemplaza a otra de la misma etiqueta no
    // muestra el aviso emergente (queda solo en el centro de notificaciones).
    etiqueta: `prueba-${Date.now()}`,
  });
  await registrarEnvio(usuarioId, 'prueba', null, `enviadas ${r.enviadas}, fallidas ${r.fallidas}`);
  if (r.enviadas === 0) throw new ErrorDeNegocio('SIN_NOTIFICACIONES');
  return r;
}

interface Vencido {
  id: string;
  usuario_id: string;
  titulo: string;
  recordatorio: Recordatorio;
  recordatorio_en: Date;
  hora_inicio: string | null;
  hora_fin: string | null;
  formato_hora: FormatoHora | null;
  suscripciones: number;
}

export interface ResultadoRecordatorios {
  enviados: number;
  omitidos: number;
  sinDispositivo: number;
}

/**
 * 7.10: los recordatorios pendientes cuyo momento llegó. Se toman con FOR UPDATE SKIP LOCKED y se marcan en la
 * misma transacción (`enviado`, u `omitido` si se atrasaron más de 30 min o si el usuario no tiene ningún
 * dispositivo con notificaciones, RB-45): así una tarea nunca avisa dos veces, aunque dos avisos coincidan.
 * El envío va después de confirmar.
 */
export async function procesarRecordatorios(
  ahora: Date = new Date(),
  /** Solo para probar:recordatorios: no toca los recordatorios de nadie más. */
  opciones: { soloUsuario?: string } = {},
): Promise<ResultadoRecordatorios> {
  const usuario = opciones.soloUsuario ?? null;
  const porEnviar = await conTransaccion(async (tx) => {
    // Las que se completaron desde master (que no conoce el recordatorio) ya no avisan.
    await tx.query(
      `UPDATE tareas_personales SET recordatorio_estado = 'omitido'
       WHERE recordatorio_estado = 'pendiente' AND estado = 'Completada' AND ($1::uuid IS NULL OR usuario_id = $1)`,
      [usuario],
    );
    const { rows } = await tx.query<Vencido>(
      `SELECT t.id, t.usuario_id, t.titulo, t.recordatorio, t.recordatorio_en,
              to_char(t.hora_inicio, 'HH24:MI') AS hora_inicio, to_char(t.hora_fin, 'HH24:MI') AS hora_fin,
              p.formato_hora,
              (SELECT count(*)::int FROM suscripciones_push s WHERE s.usuario_id = t.usuario_id) AS suscripciones
       FROM tareas_personales t
       LEFT JOIN preferencias_usuario p ON p.usuario_id = t.usuario_id
       WHERE t.recordatorio_estado = 'pendiente' AND t.recordatorio_en <= $1 AND t.estado <> 'Completada'
         AND ($2::uuid IS NULL OR t.usuario_id = $2)
       ORDER BY t.recordatorio_en
       LIMIT 200
       FOR UPDATE OF t SKIP LOCKED`,
      [ahora, usuario],
    );
    const enviar: Vencido[] = [];
    const omitir: string[] = [];
    let sinDispositivo = 0;
    for (const r of rows) {
      if (decisionEnvio(new Date(r.recordatorio_en), ahora) !== 'enviar') omitir.push(r.id);
      else if (r.suscripciones === 0) {
        omitir.push(r.id);
        sinDispositivo++;
      } else enviar.push(r);
    }
    if (omitir.length > 0) await tx.query(`UPDATE tareas_personales SET recordatorio_estado = 'omitido' WHERE id = ANY($1::uuid[])`, [omitir]);
    if (enviar.length > 0) await tx.query(`UPDATE tareas_personales SET recordatorio_estado = 'enviado' WHERE id = ANY($1::uuid[])`, [enviar.map((r) => r.id)]);
    return { enviar, omitidos: omitir.length, sinDispositivo };
  });

  for (const r of porEnviar.enviar) {
    const cuerpo = textoNotificacion(
      { recordatorio: r.recordatorio, titulo: r.titulo, horaInicio: r.hora_inicio, horaFin: r.hora_fin },
      r.formato_hora ?? '24',
    );
    try {
      const e = await enviarAUsuario(r.usuario_id, { titulo: 'Nova', cuerpo, url: rutaDeTarea(r.id), etiqueta: `tarea-${r.id}` });
      await registrarEnvio(r.usuario_id, 'recordatorio', r.id, `enviadas ${e.enviadas}, fallidas ${e.fallidas}`);
    } catch (error) {
      await registrarEnvio(r.usuario_id, 'recordatorio', r.id, `error ${error instanceof Error ? error.message : String(error)}`).catch(() => {});
    }
  }
  return { enviados: porEnviar.enviar.length, omitidos: porEnviar.omitidos, sinDispositivo: porEnviar.sinDispositivo };
}
