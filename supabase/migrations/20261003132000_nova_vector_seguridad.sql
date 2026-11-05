-- M2: índice de similitud, función de recuperación y cierre de acceso público

-- Índice de coseno para la búsqueda por similitud (ivfflat; funciona bien con el volumen de un usuario)
CREATE INDEX IF NOT EXISTS idx_fragmentos_vector
  ON fragmentos_pdf USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);

-- Recuperación de los fragmentos más similares a un vector de consulta.
CREATE OR REPLACE FUNCTION buscar_fragmentos(consulta vector(768), limite int)
RETURNS TABLE (
  id UUID, documento_id UUID, numero int, contenido text,
  nombre_archivo varchar, distancia float
)
LANGUAGE sql STABLE AS $$
  SELECT f.id, f.documento_id, f.numero, f.contenido,
         d.nombre_archivo,
         (f.vector <=> consulta) AS distancia
  FROM fragmentos_pdf f
  JOIN documentos d ON d.id = f.documento_id
  ORDER BY f.vector <=> consulta
  LIMIT limite;
$$;

ALTER TABLE tareas_personales ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fragmentos_pdf    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuentes_web       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON tareas_personales, documentos, fragmentos_pdf, fuentes_web FROM anon, authenticated;
