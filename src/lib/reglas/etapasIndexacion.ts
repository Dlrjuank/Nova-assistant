/**
 * E20b (commit 6, cambio de comportamiento de la presentación): las etapas de indexar un PDF, visibles en orden.
 * "subir" ocurre en el navegador (con su porcentaje real); las otras cuatro las avisa el servidor cuando empiezan,
 * en la misma respuesta (`application/x-ndjson`, una línea por etapa y al final la respuesta del contrato).
 * Funciones puras (sin 'use client'): las usan el servidor, la pantalla y las pruebas.
 */

export const ETAPAS_INDEXACION = [
  { id: 'subir', texto: 'Subir el archivo' },
  { id: 'leer', texto: 'Leer el texto' },
  { id: 'dividir', texto: 'Dividir en fragmentos' },
  { id: 'vectores', texto: 'Crear los vectores con Gemini' },
  { id: 'guardar', texto: 'Guardar en tu biblioteca' },
] as const;

export type EtapaIndexacion = (typeof ETAPAS_INDEXACION)[number]['id'];
/** Las que avisa el servidor. */
export type EtapaServidor = Exclude<EtapaIndexacion, 'subir'>;

/** El tipo de la respuesta con etapas; sin él, la ruta responde el JSON de siempre (scripts y pruebas). */
export const TIPO_ETAPAS = 'application/x-ndjson';

export type EstadoEtapa = 'hecha' | 'ahora' | 'fallo' | 'pendiente';

/**
 * Cómo se ve cada etapa. `actual` null con `terminado` = todas hechas. Con `fallo`, la etapa en curso queda
 * marcada como la que falló y las siguientes, pendientes.
 */
export function estadoEtapa(etapa: EtapaIndexacion, actual: EtapaIndexacion | null, opciones: { terminado?: boolean; fallo?: boolean } = {}): EstadoEtapa {
  if (opciones.terminado) return 'hecha';
  if (actual === null) return 'pendiente';
  const i = ETAPAS_INDEXACION.findIndex((e) => e.id === etapa);
  const j = ETAPAS_INDEXACION.findIndex((e) => e.id === actual);
  if (i < j) return 'hecha';
  if (i > j) return 'pendiente';
  return opciones.fallo ? 'fallo' : 'ahora';
}

/** Para lectores de pantalla: "Etapa 3 de 5: Dividir en fragmentos". */
export function textoEtapa(actual: EtapaIndexacion): string {
  const i = ETAPAS_INDEXACION.findIndex((e) => e.id === actual);
  return `Etapa ${i + 1} de ${ETAPAS_INDEXACION.length}: ${ETAPAS_INDEXACION[i]?.texto ?? ''}`;
}

export function esEtapaServidor(v: unknown): v is EtapaServidor {
  return v === 'leer' || v === 'dividir' || v === 'vectores' || v === 'guardar';
}

/**
 * Separa las líneas completas de lo que llegó; devuelve lo que queda a medias para la próxima lectura.
 * Una línea que no es JSON se ignora (no debería pasar).
 */
export function leerLineas(acumulado: string): { objetos: unknown[]; resto: string } {
  const partes = acumulado.split('\n');
  const resto = partes.pop() ?? '';
  const objetos: unknown[] = [];
  for (const p of partes) {
    if (!p.trim()) continue;
    try {
      objetos.push(JSON.parse(p));
    } catch {
      // se ignora
    }
  }
  return { objetos, resto };
}
