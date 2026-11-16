-- M12 (PLAN_AMPLIACION 6.8; E17): temas de un corte. Solo aditiva y con RLS: master no usa esta tabla. Un tema
-- manual nace confirmado y sin fuente; uno del asistente nace propuesto con la etiqueta del fragmento del PDF de
-- donde salió, y el usuario lo confirma o lo descarta (descartar lo borra). Una materia sin cortes guarda sus
-- temas en su corte único (oculto). Al borrar el corte o la materia, la base borra sus temas.

CREATE TABLE IF NOT EXISTS temas (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID          NOT NULL,
  corte_id    UUID          NOT NULL,
  nombre      VARCHAR(200)  NOT NULL,
  origen      VARCHAR(10)   NOT NULL,
  estado      VARCHAR(10)   NOT NULL,
  fuente      VARCHAR(300),
  creado_en   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT temas_corte FOREIGN KEY (corte_id, usuario_id) REFERENCES cortes (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT temas_nombre_valido CHECK (nombre = btrim(nombre) AND char_length(nombre) >= 1),
  CONSTRAINT temas_origen_valido CHECK (origen IN ('manual', 'asistente')),
  CONSTRAINT temas_estado_valido CHECK (estado IN ('propuesto', 'confirmado')),
  -- Manual: confirmado y sin fuente. Del asistente: con la etiqueta del fragmento (9.1).
  CONSTRAINT temas_origen_coherente CHECK (
    (origen = 'manual' AND estado = 'confirmado' AND fuente IS NULL) OR
    (origen = 'asistente' AND fuente IS NOT NULL AND char_length(btrim(fuente)) >= 1)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_temas_nombre ON temas (corte_id, lower(nombre));
CREATE INDEX IF NOT EXISTS idx_temas_usuario ON temas (usuario_id);
ALTER TABLE temas ENABLE ROW LEVEL SECURITY;
