import type { Pestana } from '@/components/ui/Pestanas';

/** 5.7: las pestañas de Semestre (Estadísticas desde E20). */
export function pestanasSemestre(activa: 'notas' | 'objetivos' | 'estadisticas'): Pestana[] {
  return [
    { href: '/nova/semestre', texto: 'Materias y notas', activa: activa === 'notas' },
    { href: '/nova/semestre/objetivos', texto: 'Objetivos y plan', activa: activa === 'objetivos' },
    { href: '/nova/semestre/estadisticas', texto: 'Estadísticas', activa: activa === 'estadisticas' },
  ];
}
