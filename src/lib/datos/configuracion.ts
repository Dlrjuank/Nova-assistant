import { conTransaccion, consultar } from '@/lib/db/conexion';
import { validarHoraRecordatorio } from '@/lib/reglas/recordatorios';
import { recalcularRecordatoriosSinHorario } from './tareas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import {
  PREFERENCIAS_POR_DEFECTO,
  validarCortesDefecto,
  validarNombrePerfil,
  validarNotaAprobar,
  type FormatoHora,
  type Preferencias,
  type Redondeo,
  type Tema,
} from '@/lib/reglas/preferencias';

export interface Configuracion {
  perfil: { nombre: string; email: string };
  preferencias: Preferencias;
}

export interface CambiosConfiguracion {
  nombre?: string | undefined;
  tema?: Tema | undefined;
  formatoHora?: FormatoHora | undefined;
  notaAprobar?: string | number | undefined;
  redondeo?: Redondeo | undefined;
  cortesDefecto?: Array<string | number> | undefined;
  horaRecordatorio?: string | undefined;
}

interface FilaPreferencias {
  tema: Tema;
  formato_hora: FormatoHora;
  nota_aprobar: string; // NUMERIC llega como texto: '3.00'
  redondeo: Redondeo;
  cortes_defecto: number[];
  hora_recordatorio: string; // '08:00'
}

const desdeFila = (f: FilaPreferencias): Preferencias => ({
  tema: f.tema,
  formatoHora: f.formato_hora,
  notaAprobar: Math.round(Number(f.nota_aprobar) * 100),
  redondeo: f.redondeo,
  cortesDefecto: f.cortes_defecto.map(Number),
  horaRecordatorio: f.hora_recordatorio ?? PREFERENCIAS_POR_DEFECTO.horaRecordatorio,
});

/** E11 (6.3): sin fila, los valores por defecto. */
export async function obtenerPreferencias(usuarioId: string): Promise<Preferencias> {
  const [fila] = await consultar<FilaPreferencias>(
    `SELECT tema, formato_hora, nota_aprobar, redondeo, cortes_defecto, to_char(hora_recordatorio, 'HH24:MI') AS hora_recordatorio
     FROM preferencias_usuario WHERE usuario_id = $1`,
    [usuarioId],
  );
  return fila ? desdeFila(fila) : { ...PREFERENCIAS_POR_DEFECTO, cortesDefecto: [...PREFERENCIAS_POR_DEFECTO.cortesDefecto] };
}

/** E11 (5.8): el perfil (nombre de public.users.full_name, correo de la sesión) y las preferencias. */
export async function obtenerConfiguracion(usuarioId: string, email: string): Promise<Configuracion> {
  const [[usuario], preferencias] = await Promise.all([
    consultar<{ full_name: string | null }>('SELECT full_name FROM public.users WHERE id = $1', [usuarioId]),
    obtenerPreferencias(usuarioId),
  ]);
  return { perfil: { nombre: usuario?.full_name ?? '', email }, preferencias };
}

/**
 * E11: guarda solo lo que llega. El nombre va a public.users (RB-26); lo demás, a preferencias_usuario, creando la
 * fila con los valores por defecto si no existía. Todo se valida antes de escribir nada.
 */
export async function actualizarConfiguracion(usuarioId: string, email: string, cambios: CambiosConfiguracion): Promise<Configuracion> {
  const nombre = cambios.nombre === undefined ? undefined : validarNombrePerfil(cambios.nombre);
  const nota = cambios.notaAprobar === undefined ? undefined : validarNotaAprobar(cambios.notaAprobar);
  const cortes = cambios.cortesDefecto === undefined ? undefined : validarCortesDefecto(cambios.cortesDefecto);
  const horaRecordatorio = cambios.horaRecordatorio === undefined ? undefined : validarHoraRecordatorio(cambios.horaRecordatorio);

  const columnas: Array<[string, unknown]> = [];
  if (cambios.tema !== undefined) columnas.push(['tema', cambios.tema]);
  if (cambios.formatoHora !== undefined) columnas.push(['formato_hora', cambios.formatoHora]);
  if (nota !== undefined) columnas.push(['nota_aprobar', (nota / 100).toFixed(2)]);
  if (cambios.redondeo !== undefined) columnas.push(['redondeo', cambios.redondeo]);
  if (cortes !== undefined) columnas.push(['cortes_defecto', cortes]);
  if (horaRecordatorio !== undefined) columnas.push(['hora_recordatorio', horaRecordatorio]);
  if (nombre === undefined && columnas.length === 0) throw new ErrorDeNegocio('DATOS_INVALIDOS');

  if (nombre !== undefined) await consultar('UPDATE public.users SET full_name = $2 WHERE id = $1', [usuarioId, nombre]);
  if (columnas.length > 0) {
    const nombres = columnas.map(([c]) => c);
    const valores = columnas.map(([, v]) => v);
    await conTransaccion(async (tx) => {
      await tx.query(
        `INSERT INTO preferencias_usuario (usuario_id, ${nombres.join(', ')}) VALUES ($1, ${nombres.map((_, i) => `$${i + 2}`).join(', ')})
         ON CONFLICT (usuario_id) DO UPDATE SET ${nombres.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, actualizado_en = now()`,
        [usuarioId, ...valores],
      );
      // 7.10: al cambiar la hora fija se recalculan los recordatorios de las tareas sin horario.
      if (horaRecordatorio !== undefined) await recalcularRecordatoriosSinHorario(tx, usuarioId, horaRecordatorio);
    });
  }
  return obtenerConfiguracion(usuarioId, email);
}

/** RB-25: borra todas las conversaciones del usuario; sus mensajes se van en cascada. No se puede deshacer. */
export async function borrarHistorial(usuarioId: string): Promise<{ borradas: number }> {
  const filas = await consultar<{ id: string }>('DELETE FROM conversaciones WHERE usuario_id = $1 RETURNING id', [usuarioId]);
  return { borradas: filas.length };
}
