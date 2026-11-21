import { Ban, CheckCircle2, CircleAlert, XCircle } from 'lucide-react';
import type { Materia } from '@/lib/dataService';
import type { Estado, MateriaEntrada } from '@/lib/reglas/notas';

/** Los datos guardados de una materia, como los recibe la calculadora (`reglas/notas.ts`). */
export const entradaDe = (m: Materia): MateriaEntrada => ({
  usaCortes: m.usaCortes,
  cortes: m.cortes.map((c) => ({
    nombre: c.nombre,
    porcentaje: c.porcentaje,
    componentes: c.componentes.map((k) => ({ nombre: k.nombre, porcentaje: k.porcentaje, notas: k.notas.map((n) => n.nota) })),
  })),
});

const TONO: Record<Estado, { clase: string; Icono: typeof CheckCircle2 }> = {
  Aprobada: { clase: 'text-exito border-exito/40 bg-exito/10', Icono: CheckCircle2 },
  Aprueba: { clase: 'text-exito border-exito/40 bg-exito/10', Icono: CheckCircle2 },
  'En riesgo': { clase: 'text-aviso border-aviso/40 bg-aviso/10', Icono: CircleAlert },
  // Ajuste de E20: Perdida y Reprobada en rojo lleno (texto claro sobre rojo; en oscuro el rojo es claro y el texto,
  // oscuro: el mismo par del botón de peligro, que vigila contraste.test.ts).
  Perdida: { clase: 'text-acento-texto border-peligro bg-peligro', Icono: Ban },
  Reprobada: { clase: 'text-acento-texto border-peligro bg-peligro', Icono: XCircle },
};

/** 5.7: Aprueba, En riesgo, Perdida (o Aprobada / Reprobada con todo calificado), con ícono y texto. */
export function InsigniaEstadoMateria({ estado }: { estado: Estado }) {
  const { clase, Icono } = TONO[estado];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${clase}`}>
      <Icono aria-hidden="true" className="size-3.5" />
      {estado}
    </span>
  );
}
