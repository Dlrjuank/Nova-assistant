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
// E20c-1 (RB-76): todo servicio que llama a Gemini se exporta envuelto con `usaIa`, que lo corre con la clave de
// su dueño (el primer argumento). Sin ese contexto, gemini.ts no llama a Gemini. Las rutas usan esta fachada.
import { consultar as consultarSinIa } from '@/lib/datos/consulta';
import { consultarYRegistrar as consultarYRegistrarSinIa, explicarRespuesta as explicarRespuestaSinIa } from '@/lib/datos/conversacion';
import { continuarIndexacion as continuarIndexacionSinIa, indexarDocumento as indexarDocumentoSinIa } from '@/lib/datos/documentos';
import { calcularProductividad as calcularProductividadSinIa } from '@/lib/datos/productividad';
import { proponerTemas as proponerTemasSinIa } from '@/lib/datos/temas';
import { generarPlan as generarPlanSinIa } from '@/lib/datos/planEstudio';
import { buscarEnWikipedia as buscarEnWikipediaSinIa, guardarFuenteWeb as guardarFuenteWebSinIa } from '@/lib/datos/wikipedia';
import { crearCuestionario as crearCuestionarioSinIa } from '@/lib/datos/cuestionarios';
import { usaIa } from '@/lib/llm/contextoIa';

export const consultar = usaIa(consultarSinIa);
export const consultarYRegistrar = usaIa(consultarYRegistrarSinIa);
export const explicarRespuesta = usaIa(explicarRespuestaSinIa);
export const indexarDocumento = usaIa(indexarDocumentoSinIa);
export const continuarIndexacion = usaIa(continuarIndexacionSinIa);
export const calcularProductividad = usaIa(calcularProductividadSinIa);
export const proponerTemas = usaIa(proponerTemasSinIa);
export const generarPlan = usaIa(generarPlanSinIa);
export const guardarFuenteWeb = usaIa(guardarFuenteWebSinIa);
export const crearCuestionario = usaIa(crearCuestionarioSinIa);
/** La búsqueda en Wikipedia resume con la IA: va con la clave de quien busca. */
export const buscarEnWikipedia = usaIa((_usuarioId: string, consulta: string) => buscarEnWikipediaSinIa(consulta));
export { desvincularClaveGemini, estadoIa, guardarClaveGemini, infoClaveGemini } from '@/lib/datos/claveGemini';

export { exigirAdministrador, exigirSesion, obtenerSesion } from '@/lib/auth/sesion';
export { accesoDe, exigirEspacio } from '@/lib/datos/cuentas';
export { accionSobreCuenta, cambiarTopes, eliminarCuenta, panelAdministracion } from '@/lib/datos/administracion';
export { conversacionActual, crearConversacion } from '@/lib/datos/conversacion';
export {
  eliminarDocumento,
  emitirTokenSubida,
  existenDocumentos,
  listarDocumentos,
  capitulosDeDocumento,
} from '@/lib/datos/documentos';
export { completarTarea, crearTarea, crearTareaConResultado, editarTarea, eliminarTarea, hayTareasPendientes, listarTareas, obtenerTarea } from '@/lib/datos/tareas';
export { semanaDeTareas, type Semana } from '@/lib/datos/semana';
export { mesDeTareas, type Mes } from '@/lib/datos/calendario';
export { actualizarCategoria, crearCategoria, eliminarCategoria, listarCategorias } from '@/lib/datos/categorias';
export { estadisticasSemestre } from '@/lib/datos/estadisticas';
export { avisosNavegacion } from '@/lib/datos/avisos';
export { resumenInicio, type ResumenInicio } from '@/lib/datos/inicio';
export { crearTema, documentosDeMaterias, editarTema, eliminarTema, listarTemas, type Tema } from '@/lib/datos/temas';
export { guardarVersionManual, obtenerPlan, pasarPasoATarea, planesDeMateria, restaurarVersion, type PlanCorte, type ResumenVersion, type VersionPlan } from '@/lib/datos/planEstudio';
export { crearMetaSemanal, eliminarMetaSemanal, listarMetasSemanales, type MetaConProgreso, type MetasDeLaSemana } from '@/lib/datos/metasSemanales';
export { eliminarFuenteWeb, listarFuentesWeb } from '@/lib/datos/wikipedia';
export { confirmarPlanLectura, vistaPreviaPlanLectura } from '@/lib/datos/planLectura';
export { autoevaluarPregunta, empezarIntento, obtenerCuestionario, responderPregunta } from '@/lib/datos/cuestionarios';
export { crearTareaRepaso, listarCuestionarios } from '@/lib/datos/historialCuestionarios';
export {
  crearComponente,
  crearMateria,
  crearNota,
  dividirEnCortes,
  editarComponente,
  editarMateria,
  editarNota,
  eliminarComponente,
  eliminarMateria,
  eliminarNota,
  cambiarFallas,
  guardarCortes,
  guardarFallas,
  guardarMetaNota,
  listarMaterias,
  listarMetasNota,
  materiaMasReciente,
  quitarMetaNota,
  nombresMaterias,
  obtenerMateria,
  quitarCortes,
} from '@/lib/datos/semestre';
export type { ComponenteMateria, CorteMateria, EventoSemestre, Materia, MetaNota, NotaRegistrada } from '@/lib/datos/semestre';
export { actualizarConfiguracion, borrarHistorial, obtenerConfiguracion, obtenerPreferencias, type Configuracion } from '@/lib/datos/configuracion';
export {
  borrarSuscripcion,
  clavePublicaPush,
  contarSuscripciones,
  enviarPrueba,
  guardarSuscripcion,
  procesarRecordatorios,
  procesarResumenes,
} from '@/lib/datos/notificaciones';
export { avanzarLibroEnSegundoPlano } from '@/lib/datos/documentos';
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
  FuenteGuardada,
  ResultadoWeb,
  Tarea,
  Capitulo,
  FuenteWeb,
  CapitulosDocumento,
  PlanLectura,
  ResultadoPlanLectura,
  CuestionarioCreado,
  CuestionarioVista,
  PreguntaVista,
  RespuestaVista,
  ResultadoRespuesta,
  SugerenciaRepaso,
  DocumentoHistorial,
  CuestionarioHistorial,
  IntentoHistorial,
  TareaRepasoCreada,
  ResultadoIndexacion,
} from '@/lib/datos/tipos';
