import { aLiteralVector, consultar } from '@/lib/db/conexion';
import type { Fragmento } from './tipos';

/** RN-12: los fragmentos más cercanos por distancia de coseno, solo de los documentos del usuario (RB-01). */
export async function recuperarFragmentos(usuarioId: string, vectorConsulta: number[], limite: number): Promise<Fragmento[]> {
  return consultar<Fragmento>('SELECT * FROM buscar_fragmentos_usuario($1::vector, $2, $3::uuid)', [
    aLiteralVector(vectorConsulta),
    limite,
    usuarioId,
  ]);
}
