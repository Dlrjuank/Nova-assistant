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

/**
 * E10c ("Buscar en"): los más cercanos dentro de un solo documento. `+ 0` evita el índice HNSW a propósito: con un
 * filtro tan estrecho devolvería menos filas de las pedidas, y un documento tiene pocos fragmentos para recorrer.
 */
export async function recuperarFragmentosDeDocumento(usuarioId: string, vectorConsulta: number[], limite: number, documentoId: string): Promise<Fragmento[]> {
  return consultar<Fragmento>(
    `SELECT f.id, f.documento_id, f.numero, f.contenido, d.nombre_archivo, (f.vector <=> $1::vector)::float AS distancia, f.etiqueta_paginas
     FROM fragmentos_pdf f JOIN documentos d ON d.id = f.documento_id
     WHERE d.id = $3 AND d.usuario_id = $4 AND d.progreso IS NULL
     ORDER BY (f.vector <=> $1::vector) + 0
     LIMIT $2`,
    [aLiteralVector(vectorConsulta), limite, documentoId, usuarioId],
  );
}

/** RB-41: los fragmentos de una respuesta anterior, si siguen existiendo y son del usuario. */
export async function fragmentosPorIds(usuarioId: string, ids: string[]): Promise<Array<Omit<Fragmento, 'distancia'>>> {
  return consultar<Omit<Fragmento, 'distancia'>>(
    `SELECT f.id, f.documento_id, f.numero, f.contenido, d.nombre_archivo, f.etiqueta_paginas
     FROM fragmentos_pdf f JOIN documentos d ON d.id = f.documento_id
     WHERE f.id = ANY($1::uuid[]) AND d.usuario_id = $2
     ORDER BY f.documento_id, f.numero`,
    [ids, usuarioId],
  );
}
