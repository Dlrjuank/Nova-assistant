import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export interface UsuarioRecuperacion {
  id: string;
  email: string | null;
}

export interface TokenRecuperacion {
  id: string;
  usuario_id: string;
  token_hash: string;
  expira_en: string;
  usado_en: string | null;
  creado_en: string;
}

export async function buscarUsuarioPorEmail(email: string): Promise<UsuarioRecuperacion | null> {
  const supabase = createSupabaseAdminClient();
  const patronEmail = email.trim().replace(/[\\%_]/g, '\\$&');
  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .ilike('email', patronEmail)
    .maybeSingle();

  if (error) {
    console.error(
      'La búsqueda de la cuenta para recuperación falló en Supabase. Código:',
      error.code ?? 'desconocido',
    );
    throw new Error('No se pudo buscar la cuenta para recuperación.', { cause: error });
  }

  return data;
}

export async function contarSolicitudesDeUsuario(usuarioId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('contar_solicitudes_restablecimiento', {
    p_usuario_id: usuarioId,
  });

  if (error) {
    throw new Error('No se pudo comprobar el límite de solicitudes.', { cause: error });
  }

  return Number(data);
}

export async function invalidarTokensPendientes(
  usuarioId: string,
  excluirTokenId?: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  let consulta = supabase
    .from('restablecimientos_contrasena')
    .update({ usado_en: new Date().toISOString() })
    .eq('usuario_id', usuarioId)
    .is('usado_en', null);

  if (excluirTokenId) {
    consulta = consulta.neq('id', excluirTokenId);
  }

  const { error } = await consulta;
  if (error) {
    throw new Error('No se pudieron invalidar los enlaces pendientes.', { cause: error });
  }
}

export async function crearTokenRecuperacion(
  usuarioId: string,
  tokenHash: string,
  expiraEn: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('restablecimientos_contrasena').insert({
    usuario_id: usuarioId,
    token_hash: tokenHash,
    expira_en: expiraEn,
  });

  if (error) {
    throw new Error('No se pudo crear el enlace de recuperación.', { cause: error });
  }
}

export async function buscarTokenVigentePorHash(
  tokenHash: string,
): Promise<TokenRecuperacion | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('buscar_token_restablecimiento_vigente', {
    p_token_hash: tokenHash,
  });

  if (error) {
    throw new Error('No se pudo verificar el enlace de recuperación.', { cause: error });
  }

  return data?.[0] ?? null;
}

export async function marcarTokenComoUsado(tokenId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('marcar_token_restablecimiento_usado', {
    p_token_id: tokenId,
  });

  if (error) {
    throw new Error('No se pudo consumir el enlace de recuperación.', { cause: error });
  }

  return Boolean(data?.length);
}

export async function actualizarContrasena(usuarioId: string, contrasena: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(usuarioId, { password: contrasena });

  if (error) {
    throw new Error('Supabase no pudo actualizar la contraseña.', { cause: error });
  }
}

// Nova Assistant: fachada única de datos (plan, sección 10.6).
export { exigirSesion, obtenerSesion } from '@/lib/auth/sesion';
export { consultar } from '@/lib/datos/consulta';
export { consultarYRegistrar, conversacionActual, crearConversacion, explicarRespuesta } from '@/lib/datos/conversacion';
export {
  eliminarDocumento,
  emitirTokenSubida,
  existenDocumentos,
  indexarDocumento,
  listarDocumentos,
  capitulosDeDocumento,
  continuarIndexacion,
} from '@/lib/datos/documentos';
export { completarTarea, crearTarea, editarTarea, eliminarTarea, hayTareasPendientes, listarTareas, obtenerTarea } from '@/lib/datos/tareas';
export { calcularProductividad } from '@/lib/datos/productividad';
export { semanaDeTareas, type Semana } from '@/lib/datos/semana';
export { mesDeTareas, type Mes } from '@/lib/datos/calendario';
export { actualizarCategoria, crearCategoria, eliminarCategoria, listarCategorias } from '@/lib/datos/categorias';
export { buscarEnWikipedia, eliminarFuenteWeb, listarFuentesWeb } from '@/lib/datos/wikipedia';
export type {
  Categoria,
  ConversacionActual,
  DatosTarea,
  Documento,
  EstadoTarea,
  Fragmento,
  Fuente,
  MensajeGuardado,
  RespuestaAsistente,
  RespuestaConHistorial,
  ResultadoProductividad,
  ResultadoWeb,
  Tarea,
  Capitulo,
  FuenteWeb,
  CapitulosDocumento,
  ResultadoIndexacion,
} from '@/lib/datos/tipos';
