-- M10 (PLAN_AMPLIACION 6.6; E15): metas semanales de Productividad. Solo aditiva y con RLS: master no usa esta tabla.
-- Una meta es permanente: aplica a cada semana hasta que se elimina. El progreso no se guarda; se calcula (7.8)
-- con las tareas completadas en la semana según su fecha de cierre. La categoría es el nombre guardado de una
-- categoría del usuario (NULL = todas); renombrar la categoría la renombra aquí y eliminarla elimina sus metas.

CREATE TABLE IF NOT EXISTS metas_semanales (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID          NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tipo        VARCHAR(10)   NOT NULL,
  categoria   VARCHAR(80),
  objetivo    INTEGER       NOT NULL, -- tareas, o minutos en las de tiempo
  creada_en   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT metas_semanales_tipo_valido CHECK (tipo IN ('tareas', 'minutos')),
  CONSTRAINT metas_semanales_categoria_valida CHECK (categoria IS NULL OR (categoria = btrim(categoria) AND char_length(categoria) BETWEEN 1 AND 80)),
  CONSTRAINT metas_semanales_objetivo_valido CHECK (objetivo > 0) -- RB-16
);
-- RB-17: una sola meta por tipo y categoría (sin distinguir mayúsculas); la global cuenta como una categoría más.
CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_semanales_unica ON metas_semanales (usuario_id, tipo, lower(coalesce(categoria, '')));
ALTER TABLE metas_semanales ENABLE ROW LEVEL SECURITY;
