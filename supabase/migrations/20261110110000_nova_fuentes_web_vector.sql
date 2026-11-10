-- M18 (PLAN_AMPLIACION 6.14, E10c2): el Asistente consulta las fuentes web guardadas (RB-56).
-- Solo aditiva: master no usa la columna y sus INSERT la dejan en NULL. Una fuente sin vector se vectoriza al consultar.
ALTER TABLE fuentes_web ADD COLUMN IF NOT EXISTS vector vector(768);

-- Cada usuario tiene pocas fuentes (20 por categoría): basta filtrar por dueño, sin índice vectorial.
CREATE OR REPLACE FUNCTION buscar_fuentes_web_usuario(consulta vector(768), limite int, usuario UUID)
RETURNS TABLE (id UUID, categoria text, url text, extracto text, distancia float)
LANGUAGE sql STABLE AS $$
  SELECT f.id, f.categoria::text, f.url::text, f.extracto::text, (f.vector <=> consulta)::float AS distancia
  FROM fuentes_web f
  WHERE f.usuario_id = usuario AND f.vector IS NOT NULL
  ORDER BY f.vector <=> consulta
  LIMIT limite;
$$;

REVOKE ALL ON FUNCTION buscar_fuentes_web_usuario(vector, int, UUID) FROM PUBLIC, anon, authenticated;
