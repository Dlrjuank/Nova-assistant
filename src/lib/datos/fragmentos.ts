import { aLiteralVector, consultar } from '@/lib/db/conexion';
import type { Fragmento } from './tipos';

/** RN-12: los fragmentos más cercanos por distancia de coseno. */
export async function recuperarFragmentos(vectorConsulta: number[], limite: number): Promise<Fragmento[]> {
  return consultar<Fragmento>('SELECT * FROM buscar_fragmentos($1::vector, $2)', [
    aLiteralVector(vectorConsulta),
    limite,
  ]);
}
