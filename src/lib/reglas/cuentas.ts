/**
 * E20c-2 (PLAN_AMPLIACION 5.14, 6.21 y 7.16; RB-82 a RB-89, RB-92 y RB-93): quién entra a Nova, los niveles y lo que
 * cada nivel puede hacer en "Administración". Reglas puras: el servidor las usa al decidir y las pruebas las revisan
 * sin base. La base además protege al dueño (M25, `nova_proteger_cuentas`).
 */

export type Nivel = 'dueno' | 'admin' | 'usuario';
export type EstadoCuenta = 'activa' | 'pendiente' | 'bloqueada';

export const TEXTO_CUENTA_PENDIENTE = 'Tu cuenta está esperando que el administrador la habilite.'; // RB-92
export const TEXTO_CUENTA_BLOQUEADA = 'Tu cuenta está bloqueada. Escríbele al administrador.'; // RB-82
export const TEXTO_SIN_PERMISO = 'No tienes permiso para esto.'; // RB-93
export const TEXTO_CUENTA_CAMBIO = 'Esa cuenta cambió mientras tanto. Recarga la página.';
export const TEXTO_CUENTA_NO_ENCONTRADA = 'Esa cuenta ya no existe.';
export const TEXTO_CONFIRMACION_CORREO = 'El correo no coincide. Escríbelo igual para confirmar.';
export const TEXTO_TOPE_CUENTAS = 'Escribe un número entero de 1 a 1000.'; // RB-85
export const TEXTO_TOPE_ESPACIO = 'Escribe un número entero de 1 a 500.'; // RB-85

/** RB-85: el aviso al pasar el espacio de la cuenta. */
export const textoEspacioAgotado = (mb: number) => `Llegaste al espacio máximo de tu cuenta (${mb} MB). Elimina documentos para subir más.`;

/** Lo que hay en `cuentas` para esa persona (o nada, si no tiene fila). */
export interface FilaCuenta {
  estado: EstadoCuenta;
  nivel: Nivel;
  /** E20c-3 (RB-91): entró con una contraseña temporal y aún no puso una propia. */
  debeCambiar?: boolean;
}

export type Acceso = { permitido: true; nivel: Nivel } | { permitido: false; codigo: 'CUENTA_PENDIENTE' | 'CUENTA_BLOQUEADA' | 'DEBE_CAMBIAR_CONTRASENA' };

// E20c-3 (RB-81, RB-91): textos de la entrada con Google y de la contraseña temporal.
export const TEXTO_REGISTRO_GOOGLE = 'Para crear tu cuenta, usa "Entrar con Google".';
export const TEXTO_TOPE_ALCANZADO = 'Nova llegó al máximo de cuentas por ahora. Escríbele al administrador.';
export const TEXTO_ERROR_GOOGLE = 'No se pudo entrar con Google. Intenta de nuevo.';
export const TEXTO_DEBE_CAMBIAR = 'Pon una contraseña nueva para seguir.';
export const TEXTO_TEMPORAL_USADA = 'Esta contraseña temporal ya se usó. Pide otra al administrador.';
export const TEXTO_TEMPORAL_VENCIDA = 'Esta contraseña temporal venció. Pide otra al administrador.';
export const textoContrasenaTemporal = (correo: string, contrasena: string) =>
  `Contraseña temporal para ${correo}: ${contrasena}. Cópiala ahora: no se vuelve a mostrar. Vence en 24 horas.`;
export const TEXTO_CONTRASENA_LARGO = 'La contraseña debe tener entre 8 y 128 caracteres.';
export const TEXTO_CONTRASENAS_DISTINTAS = 'Las contraseñas no coinciden.';
export const TEXTO_CONTRASENA_ACTUAL = 'La contraseña actual es incorrecta.';

/** RB-91: 16 caracteres al azar, sin los que se confunden al copiarlos (0/O, 1/l/I). */
export const ALFABETO_TEMPORAL = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export const LARGO_TEMPORAL = 16;
export const HORAS_TEMPORAL = 24;

/** `azar(n)` devuelve un entero de 0 a n − 1 (en el servidor, `crypto.randomInt`). */
export function generarContrasenaTemporal(azar: (n: number) => number): string {
  let s = '';
  for (let i = 0; i < LARGO_TEMPORAL; i++) s += ALFABETO_TEMPORAL[azar(ALFABETO_TEMPORAL.length)];
  return s;
}

/** La contraseña nueva: de 8 a 128 caracteres y escrita igual dos veces. */
export function validarContrasenaNueva(nueva: string, confirmar: string): string | null {
  if (nueva.length < 8 || nueva.length > 128) return TEXTO_CONTRASENA_LARGO;
  if (nueva !== confirmar) return TEXTO_CONTRASENAS_DISTINTAS;
  return null;
}

/** RB-91: qué pasa al entrar con la contraseña de una cuenta que debe cambiarla. */
export function revisarTemporal(fila: { debeCambiar: boolean; venceEn: string | null; usadaEn: string | null }, ahora: Date): 'normal' | 'primera' | 'usada' | 'vencida' {
  if (!fila.debeCambiar) return 'normal';
  if (fila.usadaEn) return 'usada';
  if (fila.venceEn && new Date(fila.venceEn).getTime() <= ahora.getTime()) return 'vencida';
  return 'primera';
}

/** Los correos de `SUPABASE_ADMIN_EMAILS`: solo para emergencias y pruebas automáticas (nunca el dueño). */
export function correosDeEmergencia(valor: string | undefined): string[] {
  return (valor ?? '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Acceso desde E20c-2 (RB-92, RB-93): decide la fila de `cuentas`. Entra quien la tiene `activa`; sin fila,
 * pendiente (falla cerrada). El correo incorporado del dueño siempre entra como dueño, y los de emergencia, como
 * administradores, diga lo que diga la base. La base nunca hace dueño a otra cuenta, pero si lo dijera, cuenta
 * como administrador.
 */
export function resolverAcceso(email: string, fila: FilaCuenta | null, correoDueno: string, emergencia: readonly string[]): Acceso {
  const correo = email.trim().toLowerCase();
  if (correo && correo === correoDueno.toLowerCase()) return { permitido: true, nivel: 'dueno' };
  if (correo && emergencia.includes(correo)) return { permitido: true, nivel: 'admin' };
  if (!fila || fila.estado === 'pendiente') return { permitido: false, codigo: 'CUENTA_PENDIENTE' };
  if (fila.estado === 'bloqueada') return { permitido: false, codigo: 'CUENTA_BLOQUEADA' };
  if (fila.debeCambiar) return { permitido: false, codigo: 'DEBE_CAMBIAR_CONTRASENA' };
  return { permitido: true, nivel: fila.nivel === 'dueno' ? 'admin' : fila.nivel };
}

export const esAdministrador = (nivel: Nivel) => nivel === 'dueno' || nivel === 'admin';

/** Lo que se hace con una cuenta desde "Administración" (la contraseña temporal llega en E20c-3). */
export const ACCIONES_CUENTA = ['habilitar', 'bloquear', 'desbloquear', 'nombrar_admin', 'quitar_admin', 'permiso_clave_on', 'permiso_clave_off'] as const;
export type AccionCuenta = (typeof ACCIONES_CUENTA)[number];
export type AccionRegistro = AccionCuenta | 'eliminar' | 'topes' | 'contrasena_temporal';

export interface Objetivo {
  id: string;
  nivel: Nivel;
  estado: EstadoCuenta;
}

/**
 * RB-93: si quien actúa puede hacer `accion` con esa cuenta. `'permiso'` si su nivel no lo deja (403) y
 * `'estado'` si la cuenta ya no está en el estado que la acción necesita (409: alguien la cambió mientras tanto).
 * - Administrador: habilita, bloquea y desbloquea usuarios; nunca a otro administrador, al dueño ni a sí mismo.
 * - Dueño: además nombra y quita administradores, da y quita el permiso de la clave del proyecto y elimina usuarios.
 *   A un administrador primero se le quita el nivel para bloquearlo o eliminarlo.
 */
export function revisarAccion(actor: { id: string; nivel: Nivel }, objetivo: Objetivo, accion: AccionCuenta | 'eliminar' | 'contrasena_temporal'): null | 'permiso' | 'estado' {
  if (!esAdministrador(actor.nivel) || objetivo.id === actor.id || objetivo.nivel === 'dueno') return 'permiso';
  const soloDueno = accion === 'nombrar_admin' || accion === 'quitar_admin' || accion === 'permiso_clave_on' || accion === 'permiso_clave_off' || accion === 'eliminar';
  if (soloDueno && actor.nivel !== 'dueno') return 'permiso';
  switch (accion) {
    case 'habilitar':
      if (objetivo.nivel !== 'usuario') return 'permiso';
      return objetivo.estado === 'pendiente' ? null : 'estado';
    case 'bloquear':
      if (objetivo.nivel !== 'usuario') return 'permiso';
      return objetivo.estado === 'bloqueada' ? 'estado' : null;
    case 'desbloquear':
      if (objetivo.nivel !== 'usuario') return 'permiso';
      return objetivo.estado === 'bloqueada' ? null : 'estado';
    case 'nombrar_admin':
      return objetivo.nivel === 'usuario' && objetivo.estado === 'activa' ? null : 'estado';
    case 'quitar_admin':
      return objetivo.nivel === 'admin' ? null : 'estado';
    case 'permiso_clave_on':
    case 'permiso_clave_off':
      return null;
    case 'eliminar':
      return objetivo.nivel === 'usuario' ? null : 'permiso';
    case 'contrasena_temporal':
      // RB-91: un administrador o el dueño, a un usuario activo (no a otro administrador ni al dueño).
      if (objetivo.nivel !== 'usuario') return 'permiso';
      return objetivo.estado === 'activa' ? null : 'estado';
  }
}

/** RB-85: los topes son enteros, de 1 a 1000 cuentas y de 1 a 500 MB por persona. */
export function validarTopes(cuentas: unknown, mb: unknown): null | 'cuentas' | 'espacio' {
  if (!Number.isInteger(cuentas) || (cuentas as number) < 1 || (cuentas as number) > 1000) return 'cuentas';
  if (!Number.isInteger(mb) || (mb as number) < 1 || (mb as number) > 500) return 'espacio';
  return null;
}

/** 7.16: lo que queda para las demás cuentas en el plan gratuito de Supabase. */
export const MB_DISPONIBLES = 300;

/** RB-88: el peor caso de los topes frente a los 300 MB disponibles; pasarlo solo avisa. */
export function margenTopes(cuentas: number, mb: number): { total: number; pasa: boolean; texto: string } {
  const total = cuentas * mb;
  const pasa = total > MB_DISPONIBLES;
  return {
    total,
    pasa,
    texto: pasa
      ? `${cuentas} × ${mb} MB = ${total} MB: pasa de los ${MB_DISPONIBLES} MB disponibles. Baja un tope o pasa a Supabase Pro.`
      : `${cuentas} × ${mb} MB = ${total} MB de ${MB_DISPONIBLES} MB disponibles.`,
  };
}

/** Planes gratuitos (5.14): base de Supabase y Blob de Vercel. */
export const LIMITE_BASE_BYTES = 500 * 1024 * 1024;
export const LIMITE_BLOB_BYTES = 1024 * 1024 * 1024;

export type NivelUso = 'normal' | 'aviso' | 'fuerte';

/** RB-86: aviso al 80 % y aviso fuerte al 95 %. */
export const nivelDeUso = (porcentaje: number): NivelUso => (porcentaje >= 95 ? 'fuerte' : porcentaje >= 80 ? 'aviso' : 'normal');

export const porcentajeDe = (usado: number, limite: number) => (limite > 0 ? Math.round((usado / limite) * 100) : 0);

/** RB-86: el texto del aviso de la base o de Blob (vacío por debajo del 80 %). */
export function avisoDeUso(que: 'base' | 'blob', porcentaje: number): string {
  const nivel = nivelDeUso(porcentaje);
  if (nivel === 'normal') return '';
  if (que === 'base') {
    return nivel === 'fuerte'
      ? `La base está casi llena (${porcentaje} %). Elimina datos o pasa a Supabase Pro.`
      : `La base va en ${porcentaje} % del plan gratuito.`;
  }
  return nivel === 'fuerte' ? `Blob está casi lleno (${porcentaje} %). Elimina datos o pasa a Vercel Pro.` : `Blob va en ${porcentaje} % del plan gratuito.`;
}

/** Megabytes con una cifra decimal y coma (3,4 MB). */
export function formatearMb(bytes: number): string {
  return (Math.round((bytes / (1024 * 1024)) * 10) / 10).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** RB-84: lo que dice la confirmación para eliminar y el aviso al terminar. */
export const textoConfirmarEliminar = (correo: string) => `Escribe ${correo} para confirmar. Se borrarán su cuenta y todos sus datos; no se puede deshacer.`;
export const textoEliminada = (correo: string) => `Se eliminó la cuenta ${correo}.`;
/** RB-82. */
export const textoConfirmarBloquear = (correo: string) => `¿Bloquear a ${correo}? No podrá entrar a Nova hasta que la desbloquees.`;

/** RB-84: el correo escrito tiene que ser el de la cuenta (sin importar mayúsculas ni espacios a los lados). */
export const correoConfirmado = (escrito: string, correo: string) => escrito.trim().toLowerCase() === correo.trim().toLowerCase();

/** RB-89: cada fila del registro de acciones, sin la fecha (la pantalla la pone delante). */
export function textoAccion(admin: string, accion: AccionRegistro, correo: string | null, detalle: { cuentas?: number; mb?: number } | null): string {
  const a = correo ?? '';
  switch (accion) {
    case 'bloquear':
      return `${admin} bloqueó a ${a}`;
    case 'desbloquear':
      return `${admin} desbloqueó a ${a}`;
    case 'eliminar':
      return `${admin} eliminó a ${a}`;
    case 'habilitar':
      return `${admin} habilitó a ${a}`;
    case 'nombrar_admin':
      return `${admin} nombró administrador a ${a}`;
    case 'quitar_admin':
      return `${admin} le quitó el nivel de administrador a ${a}`;
    case 'permiso_clave_on':
      return `${admin} le dio a ${a} el permiso de la clave del proyecto`;
    case 'permiso_clave_off':
      return `${admin} le quitó a ${a} el permiso de la clave del proyecto`;
    case 'contrasena_temporal':
      return `${admin} le dio una contraseña temporal a ${a}`;
    case 'topes':
      return `${admin} cambió los topes a ${detalle?.cuentas ?? '?'} cuentas y ${detalle?.mb ?? '?'} MB`;
  }
}

/** Hace cuánto, en palabras cortas: "hace 12 s", "hace 5 min", "hace 2 h", "ayer", "hace 3 días" o la fecha. */
export function haceCuanto(fecha: string | null, ahora: Date): string {
  if (!fecha) return 'Nunca';
  const ms = ahora.getTime() - new Date(fecha).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `hace ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  return fechaCorta(fecha);
}

const MESES_CORTOS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'];

/** "25 nov." en la hora de Bogotá (como en el prototipo; Intl en es-CO dice "25 de nov"). */
export function fechaCorta(fecha: string): string {
  const partes = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'numeric', timeZone: 'America/Bogota' }).formatToParts(new Date(fecha));
  const parte = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return `${parte('day')} ${MESES_CORTOS[parte('month') - 1] ?? ''}`;
}

/** "25 nov. · 19:42" en la hora de Bogotá (24 horas). */
export function fechaHora(fecha: string): string {
  const d = new Date(fecha);
  const hora = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Bogota' }).format(d);
  return `${fechaCorta(fecha)} · ${hora}`;
}

/** Los textos del nivel y del estado en la tabla de cuentas. */
export const TEXTO_NIVEL: Record<Nivel, string> = { dueno: 'Dueño', admin: 'Administrador', usuario: 'Usuario' };
export const TEXTO_ESTADO: Record<EstadoCuenta, string> = { activa: 'Activa', pendiente: 'Pendiente', bloqueada: 'Bloqueada' };

/** Filtros de la tabla de cuentas (B-104), más "Pendientes" (E20c-2). */
export const FILTROS_CUENTAS = ['Todas', 'Activas', 'Pendientes', 'Bloqueadas', 'Sin clave'] as const;
export type FiltroCuentas = (typeof FILTROS_CUENTAS)[number];

export interface CuentaFiltrable {
  correo: string;
  nombre: string;
  estado: EstadoCuenta;
  conClave: boolean;
}

export function filtrarCuentas<T extends CuentaFiltrable>(cuentas: readonly T[], busqueda: string, filtro: FiltroCuentas): T[] {
  const b = busqueda.trim().toLowerCase();
  return cuentas.filter((c) => {
    const pasa =
      filtro === 'Todas' ||
      (filtro === 'Activas' && c.estado === 'activa') ||
      (filtro === 'Pendientes' && c.estado === 'pendiente') ||
      (filtro === 'Bloqueadas' && c.estado === 'bloqueada') ||
      (filtro === 'Sin clave' && !c.conClave);
    return pasa && (!b || c.correo.toLowerCase().includes(b) || c.nombre.toLowerCase().includes(b));
  });
}

export const TEXTO_SIN_COINCIDENCIAS = 'Ninguna cuenta coincide con la búsqueda.';

const DIA_MS = 24 * 60 * 60 * 1000;

export interface CuentaResumible {
  nivel: Nivel;
  estado: EstadoCuenta;
  registro: string;
  ultimoAcceso: string | null;
  conClave: boolean;
}

export interface ResumenCuentas {
  usuarios: number;
  administradores: number;
  pendientes: number;
  activas7: number;
  nuevas: number;
  nuevasAntes: number;
  /** Cuentas nuevas por día en los últimos 7 días, del más antiguo a hoy. */
  nuevasPorDia: number[];
  conClave: number;
}

/**
 * S-91: las tarjetas de arriba. Los administradores (y el dueño) cuentan aparte: los números son de las cuentas de
 * nivel usuario. "Activas · 7 días" usa el último acceso (se anota como mucho una vez por hora).
 */
export function resumenCuentas(cuentas: readonly CuentaResumible[], ahora: Date): ResumenCuentas {
  const usuarios = cuentas.filter((c) => c.nivel === 'usuario');
  const hace = (fecha: string) => ahora.getTime() - new Date(fecha).getTime();
  const nuevasPorDia = [0, 0, 0, 0, 0, 0, 0];
  for (const c of usuarios) {
    const dias = Math.floor(hace(c.registro) / DIA_MS);
    if (dias >= 0 && dias < 7) nuevasPorDia[6 - dias] = (nuevasPorDia[6 - dias] ?? 0) + 1;
  }
  return {
    usuarios: usuarios.length,
    administradores: cuentas.length - usuarios.length,
    pendientes: usuarios.filter((c) => c.estado === 'pendiente').length,
    activas7: usuarios.filter((c) => c.estado === 'activa' && c.ultimoAcceso !== null && hace(c.ultimoAcceso) <= 7 * DIA_MS).length,
    nuevas: usuarios.filter((c) => hace(c.registro) < 7 * DIA_MS).length,
    nuevasAntes: usuarios.filter((c) => hace(c.registro) >= 7 * DIA_MS && hace(c.registro) < 14 * DIA_MS).length,
    nuevasPorDia,
    conClave: usuarios.filter((c) => c.conClave).length,
  };
}

/** Variación frente a la semana anterior: "↑ 2", "↓ 1" o "igual". */
export const textoVariacion = (ahora: number, antes: number) => (ahora > antes ? `↑ ${ahora - antes}` : ahora < antes ? `↓ ${antes - ahora}` : 'igual');

export type EstadoAviso = 'funciona' | 'errores' | 'detenido';

/** El aviso de cada minuto: detenido si no corre hace más de 5 minutos; con errores si falló en las últimas 24 h. */
export function estadoAviso(ultimo: string | null, errores: number, ahora: Date): EstadoAviso {
  if (!ultimo || ahora.getTime() - new Date(ultimo).getTime() > 5 * 60 * 1000) return 'detenido';
  return errores > 0 ? 'errores' : 'funciona';
}

export const TEXTO_ESTADO_AVISO: Record<EstadoAviso, string> = { funciona: 'Funciona', errores: 'Con errores', detenido: 'Detenido' };
