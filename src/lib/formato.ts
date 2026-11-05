/** Fecha 'YYYY-MM-DD' → texto legible es-CO (se interpreta en UTC para no correr el día). */
export function formatearFecha(fecha: string): string {
  const d = new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return fecha;
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
}

export function formatearPrioridad(prioridad: number): string {
  return ({ 1: 'Baja', 2: 'Media', 3: 'Alta' } as Record<number, string>)[prioridad] ?? String(prioridad);
}

export function formatearMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
