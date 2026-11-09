-- M15 (PLAN_AMPLIACION 6.11, E10b): páginas en cada fragmento, capítulos e indexación por partes.
-- Solo aditiva: los documentos ya indexados y los que indexe master quedan con estas columnas en NULL.

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS paginas SMALLINT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS progreso SMALLINT;          -- 0 a 99 mientras se indexa; NULL = terminado
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS por_indexar JSONB;          -- los fragmentos que faltan, para reanudar
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS indexando_hasta TIMESTAMPTZ; -- evita que dos pantallas indexen lo mismo
ALTER TABLE documentos ADD CONSTRAINT documentos_paginas_validas CHECK (paginas IS NULL OR paginas BETWEEN 1 AND 800);
ALTER TABLE documentos ADD CONSTRAINT documentos_progreso_valido CHECK (progreso IS NULL OR progreso BETWEEN 0 AND 100);
ALTER TABLE documentos ADD CONSTRAINT documentos_id_usuario UNIQUE (id, usuario_id);

ALTER TABLE fragmentos_pdf ADD COLUMN IF NOT EXISTS pagina_inicio SMALLINT;
ALTER TABLE fragmentos_pdf ADD COLUMN IF NOT EXISTS pagina_fin SMALLINT;
ALTER TABLE fragmentos_pdf ADD COLUMN IF NOT EXISTS etiqueta_paginas TEXT;   -- lo que se muestra: "45" o "45–46"
ALTER TABLE fragmentos_pdf ADD CONSTRAINT fragmentos_paginas_validas
  CHECK (pagina_inicio IS NULL OR (pagina_fin IS NOT NULL AND pagina_fin >= pagina_inicio));

CREATE TABLE IF NOT EXISTS capitulos (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id      UUID          NOT NULL,
  usuario_id        UUID          NOT NULL,
  orden             SMALLINT      NOT NULL,
  nivel             SMALLINT      NOT NULL DEFAULT 1,   -- 1 capítulo, 2 sección
  titulo            VARCHAR(200)  NOT NULL,
  pagina_inicio     SMALLINT      NOT NULL,
  pagina_fin        SMALLINT      NOT NULL,
  etiqueta_paginas  TEXT          NOT NULL,
  tarea_id          UUID          REFERENCES tareas_personales (id) ON DELETE SET NULL, -- E10d
  CONSTRAINT capitulos_documento FOREIGN KEY (documento_id, usuario_id)
    REFERENCES documentos (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT capitulos_orden_unico UNIQUE (documento_id, orden),
  CONSTRAINT capitulos_nivel_valido CHECK (nivel IN (1, 2)),
  CONSTRAINT capitulos_paginas_validas CHECK (pagina_fin >= pagina_inicio AND pagina_inicio >= 1),
  CONSTRAINT capitulos_titulo_minimo CHECK (char_length(btrim(titulo)) >= 1)
);
ALTER TABLE capitulos ENABLE ROW LEVEL SECURITY;

-- La firma de salida cambia (etiqueta_paginas), así que hay que recrearla. Solo la usa la rama de la ampliación;
-- buscar_fragmentos, la de master, no se toca. Un documento a medio indexar no entra en las búsquedas (RB-38).
DROP FUNCTION IF EXISTS buscar_fragmentos_usuario(vector, int, uuid);
CREATE FUNCTION buscar_fragmentos_usuario(consulta vector(768), limite int, usuario UUID)
RETURNS TABLE (
  id UUID, documento_id UUID, numero int, contenido text,
  nombre_archivo varchar, distancia float, etiqueta_paginas text
)
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  PERFORM set_config('hnsw.iterative_scan', 'strict_order', true);
  RETURN QUERY
    SELECT f.id, f.documento_id, f.numero, f.contenido,
           d.nombre_archivo,
           (f.vector <=> consulta)::float AS distancia,
           f.etiqueta_paginas
    FROM fragmentos_pdf f
    JOIN documentos d ON d.id = f.documento_id
    WHERE d.usuario_id = usuario AND d.progreso IS NULL
    ORDER BY f.vector <=> consulta
    LIMIT limite;
END $$;
