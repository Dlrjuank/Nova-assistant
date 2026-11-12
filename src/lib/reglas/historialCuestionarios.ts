/** E10f (PLAN_AMPLIACION 5.11, RB-53): historial de cuestionarios y sugerencia de repaso. Funciones puras. */

export const MIN_FALLADAS_REPASO = 2;

export type Comparacion = 'mejor' | 'igual' | 'peor';

export const TEXTO_COMPARACION: Record<Comparacion, string> = {
  mejor: 'Mejoraste',
  igual: 'Igual que la vez anterior',
  peor: 'Bajaste',
};

/**
 * S-58: cada intento terminado se compara con el intento terminado anterior del mismo cuestionario. Los repasos
 * de falladas ("Repaso") no se comparan ni sirven de referencia; tampoco los intentos sin terminar. El primero no
 * tiene con qué compararse. Los intentos van del más antiguo al más reciente.
 */
export function compararIntentos(intentos: ReadonlyArray<{ repaso: boolean; puntaje: number | null }>): Array<Comparacion | null> {
  let anterior: number | null = null;
  return intentos.map((i) => {
    if (i.repaso || i.puntaje === null) return null;
    const comparacion: Comparacion | null = anterior === null ? null : i.puntaje > anterior ? 'mejor' : i.puntaje < anterior ? 'peor' : 'igual';
    anterior = i.puntaje;
    return comparacion;
  });
}

/** S-59: los capítulos con 2 o más preguntas falladas, con cuántas, en el orden en que aparecen por primera vez. */
export function capitulosParaRepasar(falladas: ReadonlyArray<{ capituloId: string | null }>): Array<{ capituloId: string; falladas: number }> {
  const cuenta = new Map<string, number>();
  for (const f of falladas) if (f.capituloId) cuenta.set(f.capituloId, (cuenta.get(f.capituloId) ?? 0) + 1);
  return [...cuenta].filter(([, n]) => n >= MIN_FALLADAS_REPASO).map(([capituloId, n]) => ({ capituloId, falladas: n }));
}
