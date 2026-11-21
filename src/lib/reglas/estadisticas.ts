import { calcularCorte, calcularMateria, estadoConFallas, estadoDe, estadoFallas, formatearDecimas, maximoAlcanzable, mostrar, promedioSemestre, textoFallas, type Estado, type MateriaEntrada } from './notas';
import type { Redondeo } from './preferencias';

/**
 * E20 (PLAN_AMPLIACION 5.7, 7.4, 7.7; B-40): los datos de la pestaña Estadísticas, calculados con las mismas reglas
 * que "Materias y notas" (notas exactas, redondeo de Configuración, fallas). Las notas salen en décimas (38 = 3,8).
 */

export interface MateriaParaEstadisticas {
  id: string;
  nombre: string;
  creditos: number;
  fallasLimite: number | null;
  fallasRegistradas: number;
  entrada: MateriaEntrada;
}

export interface CorteEstadistica {
  nombre: string;
  /** Porcentaje en centésimas (3000 = 30 %). */
  porcentaje: number;
  /** Nota del corte en décimas, o null sin notas. */
  nota: number | null;
}

export type MotivoRiesgo = 'nota' | 'fallas';

export interface MateriaEstadistica {
  id: string;
  nombre: string;
  creditos: number;
  usaCortes: boolean;
  cortes: CorteEstadistica[];
  /** Nota actual de la materia en décimas, o null sin notas (RB-13). */
  actual: number | null;
  definitiva: boolean;
  /** El estado de "Materias y notas" (7.4 con las fallas de 7.7). */
  estado: Estado | null;
  /** Por qué está en riesgo, con su texto; vacío si no lo está. */
  riesgo: Array<{ motivo: MotivoRiesgo; texto: string }>;
  /** 7.7: llegó al límite de fallas. */
  perdidaPorFallas: boolean;
}

export interface Estadisticas {
  materias: MateriaEstadistica[];
  /** Las que están en riesgo, de la más grave a la menos grave. */
  enRiesgo: MateriaEstadistica[];
  /** Promedio actual del semestre en décimas (7.6), o null. */
  promedio: number | null;
  /** La nota para aprobar de Configuración, en décimas (la línea de los gráficos). */
  aprobar: number;
}

/** Riesgo por nota (7.4): "En riesgo", "Perdida" o "Reprobada", con un texto que dice qué significa. */
function riesgoPorNota(estado: Estado | null, actual: number | null, aprobar: number, maximo: number): string | null {
  const a = formatearDecimas(aprobar);
  if (estado === 'En riesgo') return `Por nota: hoy tienes ${formatearDecimas(actual ?? 0)} y aún puedes llegar a ${a}.`;
  if (estado === 'Perdida') return `Perdida por nota: aunque saques 5,0 en lo que falta, llegas a ${formatearDecimas(maximo)} y necesitas ${a}.`;
  if (estado === 'Reprobada') return `Por nota: terminó con ${formatearDecimas(actual ?? 0)}, por debajo de ${a}.`;
  return null;
}

/** Ajuste de E20: perdida (o reprobada), la de más gravedad. */
export const esPerdida = (m: Pick<MateriaEstadistica, 'estado'>) => m.estado === 'Perdida' || m.estado === 'Reprobada';

/** Gravedad para ordenar la lista: perdidas y reprobadas primero (las de fallas antes), luego en riesgo y alertas. */
function gravedad(m: MateriaEstadistica): number {
  if (m.perdidaPorFallas) return 0;
  if (esPerdida(m)) return 1;
  if (m.estado === 'En riesgo') return 2;
  return 3;
}

/** 5.7: evolución por corte, comparación entre materias y materias en riesgo (por nota o por fallas). */
export function calcularEstadisticas(materias: readonly MateriaParaEstadisticas[], notaAprobar: number, redondeo: Redondeo): Estadisticas {
  const calculos = materias.map((m) => calcularMateria(m.entrada));
  const lista = materias.map((m, i): MateriaEstadistica => {
    const c = calculos[i] as ReturnType<typeof calcularMateria>;
    const actual = c.actual === null ? null : mostrar(c.actual, redondeo);
    const deNotas = estadoDe(c, notaAprobar, redondeo);
    const fallas = estadoFallas(m.fallasLimite, m.fallasRegistradas);
    const riesgo: MateriaEstadistica['riesgo'] = [];
    const porFallas = textoFallas(fallas, m.fallasLimite, m.fallasRegistradas);
    if (fallas.tipo === 'perdida') riesgo.push({ motivo: 'fallas', texto: `Perdida por fallas: ${m.fallasRegistradas} de ${m.fallasLimite}.` });
    else if (porFallas) riesgo.push({ motivo: 'fallas', texto: `Por fallas: ${porFallas.charAt(0).toLowerCase()}${porFallas.slice(1)}` });
    const porNota = riesgoPorNota(deNotas, actual, Math.ceil(notaAprobar / 10), mostrar(maximoAlcanzable(c), redondeo));
    if (porNota) riesgo.push({ motivo: 'nota', texto: porNota });
    return {
      id: m.id,
      nombre: m.nombre,
      creditos: m.creditos,
      usaCortes: m.entrada.usaCortes,
      cortes: m.entrada.usaCortes
        ? m.entrada.cortes.map((corte) => {
            const nota = calcularCorte(corte).actual;
            return { nombre: corte.nombre, porcentaje: corte.porcentaje, nota: nota === null ? null : mostrar(nota, redondeo) };
          })
        : [],
      actual,
      definitiva: c.definitiva,
      estado: estadoConFallas(deNotas, fallas),
      riesgo,
      perdidaPorFallas: fallas.tipo === 'perdida',
    };
  });
  const promedio = promedioSemestre(materias.map((m, i) => ({ creditos: m.creditos, calculo: calculos[i] as ReturnType<typeof calcularMateria> }))).actual;
  const enRiesgo = lista
    .filter((m) => m.riesgo.length > 0)
    .sort((a, b) => gravedad(a) - gravedad(b) || a.nombre.localeCompare(b.nombre, 'es'));
  return { materias: lista, enRiesgo, promedio: promedio === null ? null : mostrar(promedio, redondeo), aprobar: Math.ceil(notaAprobar / 10) };
}

/** Ajuste de E20: "1 perdida · 2 en riesgo", "2 perdidas", "1 en riesgo" o "Ninguna materia en riesgo". */
export function textoEnRiesgo(perdidas: number, enRiesgo: number): string {
  const partes = [perdidas > 0 ? `${perdidas} ${perdidas === 1 ? 'perdida' : 'perdidas'}` : '', enRiesgo > 0 ? `${enRiesgo} en riesgo` : ''].filter(Boolean);
  return partes.length === 0 ? 'Ninguna materia en riesgo' : partes.join(' · ');
}
