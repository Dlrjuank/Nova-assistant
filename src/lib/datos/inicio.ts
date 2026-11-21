import { consultar } from '@/lib/db/conexion';
import { semanaDe, sumarDias } from '@/lib/reglas/fechas';
import { calcularMateria, cuantoNecesito, mostrar, promedioSemestre, textoCuantoNecesito, type MateriaEntrada } from '@/lib/reglas/notas';
import { obtenerPreferencias } from './configuracion';
import { listarMaterias, listarMetasNota, type Materia } from './semestre';

/** E20b (commit 2): lo que agrega el Inicio nuevo, además de la semana de siempre (semanaDeTareas). */
export interface ResumenInicio {
  /** El nombre del perfil (Configuración); vacío si no lo ha puesto. */
  nombre: string;
  /** Las tareas con fecha límite hoy: todas, las pendientes y, de esas, las que tienen horario. */
  hoy: { total: number; pendientes: number; conHorario: number };
  /** La vencida más antigua (título y fecha límite), para la tarjeta de vencidas. */
  vencidaMasAntigua: { titulo: string; fecha: string } | null;
  /** Minutos registrados al completar tareas, de lunes a domingo de la semana actual (cerradas ese día). */
  minutosPorDia: number[];
  /** Lunes a hoy de esta semana, y lunes a (hoy − 7) de la pasada: lo mismo, para comparar. */
  minutosHastaHoy: number;
  minutosSemanaPasada: number;
  /** Promedio del semestre en décimas (actual y asegurado) y cuántas materias hay. */
  promedio: { actual: number | null; asegurado: number | null; materias: number; aprobar: number };
  /** El corte con fecha más próxima desde hoy, con lo que necesitas para tu meta (o para aprobar). */
  proximoCorte: { materiaId: string; materia: string; corte: string; fecha: string; porcentaje: number | null; texto: string | null } | null;
}

const entradaDe = (m: Materia): MateriaEntrada => ({
  usaCortes: m.usaCortes,
  cortes: m.cortes.map((c) => ({
    nombre: c.nombre,
    porcentaje: c.porcentaje,
    componentes: c.componentes.map((k) => ({ nombre: k.nombre, porcentaje: k.porcentaje, notas: k.notas.map((n) => n.nota) })),
  })),
});

/** Solo del usuario (RB-01). `hoy` en AAAA-MM-DD (Bogotá). */
export async function resumenInicio(usuarioId: string, hoy: string): Promise<ResumenInicio> {
  const { lunes, domingo } = semanaDe(hoy);
  const lunesPasado = sumarDias(lunes, -7);
  const [usuario, deHoy, vencida, minutos, materias, preferencias] = await Promise.all([
    consultar<{ full_name: string | null }>('SELECT full_name FROM public.users WHERE id = $1', [usuarioId]),
    consultar<{ total: number; pendientes: number; con_horario: number }>(
      `SELECT COUNT(*)::bigint AS total,
         COUNT(*) FILTER (WHERE estado <> 'Completada')::bigint AS pendientes,
         COUNT(*) FILTER (WHERE estado <> 'Completada' AND hora_inicio IS NOT NULL)::bigint AS con_horario
       FROM tareas_personales WHERE usuario_id = $1 AND fecha_limite = $2`,
      [usuarioId, hoy],
    ),
    consultar<{ titulo: string; fecha: string }>(
      `SELECT titulo, to_char(fecha_limite, 'YYYY-MM-DD') AS fecha FROM tareas_personales
       WHERE usuario_id = $1 AND estado <> 'Completada' AND fecha_limite < $2
       ORDER BY fecha_limite, created_at LIMIT 1`,
      [usuarioId, hoy],
    ),
    // BIGINT en la suma, como en Productividad.
    consultar<{ dia: string; minutos: number }>(
      `SELECT to_char(fecha_cierre, 'YYYY-MM-DD') AS dia, COALESCE(SUM(minutos_invertidos), 0)::bigint AS minutos
       FROM tareas_personales
       WHERE usuario_id = $1 AND estado = 'Completada' AND fecha_cierre BETWEEN $2::date AND $3::date
       GROUP BY fecha_cierre`,
      [usuarioId, lunesPasado, domingo],
    ),
    listarMaterias(usuarioId),
    obtenerPreferencias(usuarioId),
  ]);

  const porDia = new Map(minutos.map((f) => [f.dia, Number(f.minutos)]));
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const minutosPorDia = dias.map((d) => porDia.get(d) ?? 0);
  const minutosHastaHoy = dias.filter((d) => d <= hoy).reduce((s, d) => s + (porDia.get(d) ?? 0), 0);
  const hoyPasado = sumarDias(hoy, -7);
  const minutosSemanaPasada = Array.from({ length: 7 }, (_, i) => sumarDias(lunesPasado, i))
    .filter((d) => d <= hoyPasado)
    .reduce((s, d) => s + (porDia.get(d) ?? 0), 0);

  const { notaAprobar, redondeo } = preferencias;
  const calculos = materias.map((m) => ({ m, calculo: calcularMateria(entradaDe(m)) }));
  const prom = promedioSemestre(calculos.map(({ m, calculo }) => ({ creditos: m.creditos, calculo })));

  // El próximo corte: la fecha más cercana desde hoy; a igualdad, la materia por nombre.
  const candidatos = materias
    .flatMap((m) => m.cortes.filter((c) => c.fecha !== null && c.fecha >= hoy).map((c) => ({ m, c })))
    .sort((a, b) => (a.c.fecha as string).localeCompare(b.c.fecha as string) || a.m.nombre.localeCompare(b.m.nombre, 'es') || a.c.orden - b.c.orden);
  let proximoCorte: ResumenInicio['proximoCorte'] = null;
  const primero = candidatos[0];
  if (primero) {
    const { m, c } = primero;
    const metas = await listarMetasNota(usuarioId, m.id);
    // La meta de la materia (Objetivos y plan) o, si no hay, la nota para aprobar de Configuración.
    const objetivo = metas.find((x) => x.corteId === null)?.meta ?? notaAprobar;
    const calculo = calculos.find((x) => x.m.id === m.id)?.calculo;
    const necesito = calculo ? cuantoNecesito(calculo, objetivo, redondeo) : null;
    proximoCorte = {
      materiaId: m.id,
      materia: m.nombre,
      corte: c.nombre,
      fecha: c.fecha as string,
      porcentaje: m.usaCortes ? c.porcentaje : null,
      texto: necesito ? textoCuantoNecesito(necesito, objetivo) : null,
    };
  }

  return {
    nombre: usuario[0]?.full_name ?? '',
    hoy: { total: Number(deHoy[0]?.total ?? 0), pendientes: Number(deHoy[0]?.pendientes ?? 0), conHorario: Number(deHoy[0]?.con_horario ?? 0) },
    vencidaMasAntigua: vencida[0] ?? null,
    minutosPorDia,
    minutosHastaHoy,
    minutosSemanaPasada,
    promedio: {
      actual: prom.actual ? mostrar(prom.actual, redondeo) : null,
      asegurado: prom.asegurado ? mostrar(prom.asegurado, redondeo) : null,
      materias: materias.length,
      aprobar: Math.ceil(notaAprobar / 10),
    },
    proximoCorte,
  };
}
