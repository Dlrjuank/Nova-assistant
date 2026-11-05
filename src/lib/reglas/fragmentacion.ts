import { FRAGMENTO_PALABRAS, FRAGMENTO_SOLAPAMIENTO } from '@/lib/config/nova';

/** RN-10: trozos de FRAGMENTO_PALABRAS palabras; cada uno empieza FRAGMENTO_SOLAPAMIENTO antes del final del anterior. */
export function fragmentar(texto: string): Array<{ numero: number; contenido: string }> {
  const normal = texto.trim().replace(/\s+/g, ' ');
  if (normal === '') return [];
  const palabras = normal.split(' ');
  const paso = FRAGMENTO_PALABRAS - FRAGMENTO_SOLAPAMIENTO;
  const fragmentos: Array<{ numero: number; contenido: string }> = [];

  for (let inicio = 0; ; inicio += paso) {
    const fin = inicio + FRAGMENTO_PALABRAS;
    fragmentos.push({ numero: fragmentos.length + 1, contenido: palabras.slice(inicio, fin).join(' ') });
    if (fin >= palabras.length) break;
  }
  return fragmentos;
}
