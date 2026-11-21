import { calcularEstadisticas, type Estadisticas } from '@/lib/reglas/estadisticas';
import type { MateriaEntrada } from '@/lib/reglas/notas';
import { obtenerPreferencias } from './configuracion';
import { listarMaterias, type Materia } from './semestre';

const entradaDe = (m: Materia): MateriaEntrada => ({
  usaCortes: m.usaCortes,
  cortes: m.cortes.map((c) => ({
    nombre: c.nombre,
    porcentaje: c.porcentaje,
    componentes: c.componentes.map((k) => ({ nombre: k.nombre, porcentaje: k.porcentaje, notas: k.notas.map((n) => n.nota) })),
  })),
});

/** E20 (5.7, B-40): las estadísticas del semestre del usuario, con su nota para aprobar y su redondeo. */
export async function estadisticasSemestre(usuarioId: string): Promise<Estadisticas> {
  const [materias, { notaAprobar, redondeo }] = await Promise.all([listarMaterias(usuarioId), obtenerPreferencias(usuarioId)]);
  return calcularEstadisticas(
    materias.map((m) => ({ id: m.id, nombre: m.nombre, creditos: m.creditos, fallasLimite: m.fallasLimite, fallasRegistradas: m.fallasRegistradas, entrada: entradaDe(m) })),
    notaAprobar,
    redondeo,
  );
}
