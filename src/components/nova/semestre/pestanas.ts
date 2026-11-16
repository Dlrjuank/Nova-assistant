import type { Pestana } from '@/components/ui/Pestanas';

/** 5.7: las pestañas de Semestre que ya existen (Estadísticas llega en E20). */
export function pestanasSemestre(activa: 'notas' | 'objetivos'): Pestana[] {
  return [
    { href: '/nova/semestre', texto: 'Materias y notas', activa: activa === 'notas' },
    { href: '/nova/semestre/objetivos', texto: 'Objetivos y plan', activa: activa === 'objetivos' },
  ];
}
