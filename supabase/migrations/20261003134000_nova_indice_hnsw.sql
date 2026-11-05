-- M3: reemplaza el índice ivfflat por HNSW.
-- ivfflat se entrena con los datos existentes (tabla vacía al migrar) y con pocos fragmentos
-- devuelve menos resultados de los pedidos; HNSW no requiere entrenamiento y no tiene ese problema.
DROP INDEX IF EXISTS idx_fragmentos_vector;
CREATE INDEX IF NOT EXISTS idx_fragmentos_vector
  ON fragmentos_pdf USING hnsw (vector vector_cosine_ops);
