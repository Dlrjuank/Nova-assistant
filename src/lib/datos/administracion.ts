import { list } from '@vercel/blob';
import type { PoolClient } from 'pg';
import type { SesionNova } from '@/lib/auth/sesion';
import { consultar, conTransaccion } from '@/lib/db/conexion';
import { olvidarClaveEnMemoria } from '@/lib/datos/claveGemini';
import {
  correoConfirmado,
  revisarAccion,
  TEXTO_SIN_PERMISO,
  validarTopes,
  type AccionCuenta,
  type AccionRegistro,
  type EstadoCuenta,
  type Nivel,
} from '@/lib/reglas/cuentas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * E20c-2 (PLAN_AMPLIACION 5.14, 6.21; RB-82 a RB-89, RB-92, RB-93): los datos de "Administración" y sus acciones.
 * Nadie ve desde aquí tareas, documentos ni conversaciones de otros: solo correo, nombre, registro, uso (MB y
 * consultas a Gemini), estado y nivel de cada cuenta; la actividad son solo conteos por día de todas juntas.
 */

export interface CuentaAdmin {
  id: string;
  correo: string;
  nombre: string;
  registro: string;
  ultimoAcceso: string | null;
  bytes: number;
  /** Llamadas a Gemini en los últimos 7 días (M24, solo el conteo). */
  consultas: number;
  conClave: boolean;
  estado: EstadoCuenta;
  nivel: Nivel;
  usaClaveProyecto: boolean;
}

export interface AccionAdmin {
  id: number;
  fecha: string;
  admin: string;
  accion: AccionRegistro;
  correo: string | null;
  detalle: { cuentas?: number; mb?: number } | null;
}

export interface PanelAdministracion {
  ahora: string;
  yo: { id: string; nivel: Nivel };
  cuentas: CuentaAdmin[];
  topes: { cuentas: number; mb: number };
  espacio: { baseBytes: number; blobBytes: number | null };
  /** Los últimos 14 días de Bogotá, del más antiguo a hoy. */
  actividad: { dias: string[]; preguntas: number[]; registros: number[]; documentos: number[] };
  sistema: { ultimoAviso: string | null; erroresDia: number; ultimaLimpieza: string | null; filasLimpiadas: number | null };
  registro: AccionAdmin[];
}

/** Blob: listar gasta operaciones avanzadas (2.000 al mes), así que el total se recuerda 1 hora en cada instancia. */
const BLOB_MEMORIA_MS = 60 * 60 * 1000;
let blobGuardado: { bytes: number; hasta: number } | null = null;

async function bytesEnBlob(): Promise<number | null> {
  if (blobGuardado && blobGuardado.hasta > Date.now()) return blobGuardado.bytes;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    let total = 0;
    let cursor: string | undefined;
    do {
      const pagina = await list({ limit: 1000, ...(cursor ? { cursor } : {}) });
      total += pagina.blobs.reduce((s, b) => s + b.size, 0);
      cursor = pagina.hasMore ? pagina.cursor : undefined;
    } while (cursor);
    blobGuardado = { bytes: total, hasta: Date.now() + BLOB_MEMORIA_MS };
    return total;
  } catch (error) {
    console.error('No se pudo medir Vercel Blob:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** El aviso de cada minuto (E11c): su última ejecución y los errores del día (de pg_cron y de la llamada a Vercel). */
async function estadoDelAviso(): Promise<{ ultimoAviso: string | null; erroresDia: number }> {
  const [cron] = await consultar<{ ultimo: string | null; fallas: number }>(
    `SELECT max(r.start_time) AS ultimo,
            count(*) FILTER (WHERE r.status = 'failed' AND r.start_time > now() - interval '24 hours') AS fallas
     FROM cron.job_run_details r JOIN cron.job j ON j.jobid = r.jobid
     WHERE j.jobname = 'nova-recordatorios'`,
  );
  // pg_net guarda las respuestas solo unas horas: cuenta las que fallaron de las que aún tiene.
  const [red] = await consultar<{ fallas: number }>(
    `SELECT count(*) AS fallas FROM net._http_response
     WHERE created > now() - interval '24 hours' AND (status_code IS NULL OR status_code >= 400)`,
  ).catch(() => [{ fallas: 0 }]);
  return { ultimoAviso: cron?.ultimo ?? null, erroresDia: Number(cron?.fallas ?? 0) + Number(red?.fallas ?? 0) };
}

export async function panelAdministracion(sesion: SesionNova): Promise<PanelAdministracion> {
  const [cuentas, [config], [base], actividad, sistema, registro, blobBytes] = await Promise.all([
    consultar<CuentaAdmin & { bytes: string }>(
      `SELECT u.id, u.email AS correo,
              coalesce(nullif(trim(pu.full_name), ''), nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''), '') AS nombre,
              coalesce(c.creada_en, u.created_at) AS registro,
              c.ultimo_acceso AS "ultimoAcceso",
              coalesce(e.bytes, 0) AS bytes,
              coalesce((SELECT sum(x.consultas) FROM uso_ia_diario x
                        WHERE x.usuario_id = u.id AND x.dia > (now() AT TIME ZONE 'America/Bogota')::date - 7), 0)::int AS consultas,
              EXISTS (SELECT 1 FROM claves_gemini k WHERE k.usuario_id = u.id) AS "conClave",
              coalesce(c.estado, 'pendiente') AS estado,
              coalesce(c.nivel, 'usuario') AS nivel,
              coalesce(c.usa_clave_proyecto, false) AS "usaClaveProyecto"
       FROM auth.users u
       LEFT JOIN cuentas c ON c.usuario_id = u.id
       LEFT JOIN public.users pu ON pu.id = u.id
       LEFT JOIN nova_espacio() e ON e.usuario_id = u.id
       ORDER BY coalesce(e.bytes, 0) DESC, u.created_at`,
    ),
    consultar<{ cuentas: number; mb: number; ultimaLimpieza: string | null; filasLimpiadas: number | null }>(
      `SELECT tope_cuentas AS cuentas, tope_espacio_mb AS mb, ultima_limpieza AS "ultimaLimpieza", filas_limpiadas AS "filasLimpiadas"
       FROM administracion WHERE id = 1`,
    ),
    consultar<{ bytes: string }>('SELECT pg_database_size(current_database()) AS bytes'),
    consultar<{ dia: string; preguntas: number; registros: number; documentos: number }>(
      `WITH dias AS (
         SELECT generate_series((now() AT TIME ZONE 'America/Bogota')::date - 13, (now() AT TIME ZONE 'America/Bogota')::date, interval '1 day')::date AS dia
       )
       SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
              (SELECT count(*) FROM mensajes_chat m WHERE m.autor = 'usuario' AND (m.creado_en AT TIME ZONE 'America/Bogota')::date = d.dia)::int AS preguntas,
              (SELECT count(*) FROM auth.users u WHERE (u.created_at AT TIME ZONE 'America/Bogota')::date = d.dia)::int AS registros,
              (SELECT count(*) FROM documentos x WHERE (x.created_at AT TIME ZONE 'America/Bogota')::date = d.dia)::int AS documentos
       FROM dias d ORDER BY d.dia`,
    ),
    estadoDelAviso(),
    consultar<AccionAdmin>(
      `SELECT a.id, a.creada_en AS fecha, coalesce(u.email, 'Una cuenta eliminada') AS admin, a.accion, a.correo, a.detalle
       FROM acciones_admin a LEFT JOIN auth.users u ON u.id = a.admin_id
       ORDER BY a.creada_en DESC, a.id DESC LIMIT 20`,
    ),
    bytesEnBlob(),
  ]);
  return {
    ahora: new Date().toISOString(),
    yo: { id: sesion.id, nivel: sesion.nivel },
    cuentas: cuentas.map((c) => ({ ...c, bytes: Number(c.bytes) })),
    topes: { cuentas: config?.cuentas ?? 15, mb: config?.mb ?? 30 },
    espacio: { baseBytes: Number(base?.bytes ?? 0), blobBytes },
    actividad: {
      dias: actividad.map((a) => a.dia),
      preguntas: actividad.map((a) => a.preguntas),
      registros: actividad.map((a) => a.registros),
      documentos: actividad.map((a) => a.documentos),
    },
    sistema: { ...sistema, ultimaLimpieza: config?.ultimaLimpieza ?? null, filasLimpiadas: config?.filasLimpiadas ?? null },
    registro,
  };
}

/** Lo que cambia en `cuentas` con cada acción. */
const CAMBIO: Record<AccionCuenta, string> = {
  habilitar: "estado = 'activa'",
  bloquear: "estado = 'bloqueada', bloqueada_en = now()",
  desbloquear: "estado = 'activa', bloqueada_en = NULL",
  nombrar_admin: "nivel = 'admin'",
  quitar_admin: "nivel = 'usuario'",
  permiso_clave_on: 'usa_clave_proyecto = true',
  permiso_clave_off: 'usa_clave_proyecto = false',
};

/** Cuenta objetivo con su fila bloqueada para la transacción (si no tenía fila, nace pendiente, como con el disparador). */
async function cuentaParaCambiar(tx: PoolClient, id: string) {
  const { rows: usuarios } = await tx.query<{ correo: string }>('SELECT email AS correo FROM auth.users WHERE id = $1', [id]);
  const usuario = usuarios[0];
  if (!usuario) throw new ErrorDeNegocio('CUENTA_NO_ENCONTRADA');
  await tx.query('INSERT INTO cuentas (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO NOTHING', [id]);
  const { rows } = await tx.query<{ estado: EstadoCuenta; nivel: Nivel }>('SELECT estado, nivel FROM cuentas WHERE usuario_id = $1 FOR UPDATE', [id]);
  return { correo: usuario.correo, ...(rows[0] as { estado: EstadoCuenta; nivel: Nivel }) };
}

function exigirPermitida(resultado: ReturnType<typeof revisarAccion>): void {
  if (resultado === 'permiso') throw new ErrorDeNegocio('ACCESO_DENEGADO', TEXTO_SIN_PERMISO);
  if (resultado === 'estado') throw new ErrorDeNegocio('CUENTA_CAMBIO');
}

/** Supabase Auth: una cuenta bloqueada tampoco puede renovar su sesión ni volver a entrar (RB-82). */
async function prohibirEnAuth(id: string, prohibir: boolean): Promise<void> {
  try {
    const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(id, { ban_duration: prohibir ? '876000h' : 'none' });
    if (error) console.error('Supabase no aplicó el bloqueo en Auth:', error.message);
  } catch (error) {
    // La cuenta igual queda bloqueada: exigirSesion revisa `cuentas` en cada pedido.
    console.error('No se pudo aplicar el bloqueo en Supabase Auth:', error instanceof Error ? error.message : error);
  }
}

/** RB-82, RB-92, RB-93: habilitar, bloquear, desbloquear, nombrar o quitar administradores y el permiso de la clave. */
export async function accionSobreCuenta(sesion: SesionNova, id: string, accion: AccionCuenta): Promise<{ estado: EstadoCuenta; nivel: Nivel; usaClaveProyecto: boolean }> {
  const resultado = await conTransaccion(async (tx) => {
    const objetivo = await cuentaParaCambiar(tx, id);
    exigirPermitida(revisarAccion(sesion, { id, nivel: objetivo.nivel, estado: objetivo.estado }, accion));
    const { rows } = await tx.query<{ estado: EstadoCuenta; nivel: Nivel; usaClaveProyecto: boolean }>(
      `UPDATE cuentas SET ${CAMBIO[accion]} WHERE usuario_id = $1 RETURNING estado, nivel, usa_clave_proyecto AS "usaClaveProyecto"`,
      [id],
    );
    await tx.query('INSERT INTO acciones_admin (admin_id, accion, correo) VALUES ($1, $2, $3)', [sesion.id, accion, objetivo.correo]);
    return rows[0] as { estado: EstadoCuenta; nivel: Nivel; usaClaveProyecto: boolean };
  });
  if (accion === 'bloquear') await prohibirEnAuth(id, true);
  if (accion === 'desbloquear') await prohibirEnAuth(id, false);
  // La clave resuelta se recuerda 5 minutos por instancia: en las demás, el permiso cambia a más tardar entonces.
  if (accion === 'permiso_clave_on' || accion === 'permiso_clave_off') olvidarClaveEnMemoria(id);
  return resultado;
}

/**
 * RB-84 (solo el dueño): eliminar la cuenta escribiendo su correo. Borrar la cuenta de Supabase Auth borra en cascada
 * todos sus datos (cada tabla con `usuario_id` o colgada de una que lo tiene). Los PDF ya no están en Blob: se borran
 * al terminar de leerlos.
 */
export async function eliminarCuenta(sesion: SesionNova, id: string, correoEscrito: string): Promise<{ correo: string }> {
  if (sesion.nivel !== 'dueno') throw new ErrorDeNegocio('ACCESO_DENEGADO', TEXTO_SIN_PERMISO);
  const objetivo = await conTransaccion(async (tx) => {
    const o = await cuentaParaCambiar(tx, id);
    exigirPermitida(revisarAccion(sesion, { id, nivel: o.nivel, estado: o.estado }, 'eliminar'));
    if (!correoConfirmado(correoEscrito, o.correo)) throw new ErrorDeNegocio('CONFIRMACION_CORREO');
    return o;
  });
  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(id);
  if (error) {
    console.error('Supabase no eliminó la cuenta:', error.message);
    throw new ErrorDeNegocio('ERROR_INTERNO');
  }
  await consultar('INSERT INTO acciones_admin (admin_id, accion, correo) VALUES ($1, $2, $3)', [sesion.id, 'eliminar', objetivo.correo]);
  return { correo: objetivo.correo };
}

/** RB-85, RB-88 (solo el dueño): cambiar los topes. Bajar un tope no borra nada. */
export async function cambiarTopes(sesion: SesionNova, cuentas: number, mb: number): Promise<{ cuentas: number; mb: number }> {
  if (sesion.nivel !== 'dueno') throw new ErrorDeNegocio('ACCESO_DENEGADO', TEXTO_SIN_PERMISO);
  const invalido = validarTopes(cuentas, mb);
  if (invalido === 'cuentas') throw new ErrorDeNegocio('TOPE_CUENTAS_INVALIDO');
  if (invalido === 'espacio') throw new ErrorDeNegocio('TOPE_ESPACIO_INVALIDO');
  return conTransaccion(async (tx) => {
    const { rows } = await tx.query<{ cuentas: number; mb: number }>('SELECT tope_cuentas AS cuentas, tope_espacio_mb AS mb FROM administracion WHERE id = 1 FOR UPDATE');
    const antes = rows[0];
    await tx.query('UPDATE administracion SET tope_cuentas = $1, tope_espacio_mb = $2, actualizada_en = now() WHERE id = 1', [cuentas, mb]);
    await tx.query("INSERT INTO acciones_admin (admin_id, accion, detalle) VALUES ($1, 'topes', $2::jsonb)", [sesion.id, JSON.stringify({ cuentas, mb, antes })]);
    return { cuentas, mb };
  });
}
