-- M1: extensión pgvector y tablas de Nova Assistant

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tareas_personales (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          VARCHAR(200)  NOT NULL,
  categoria       VARCHAR(80)   NOT NULL DEFAULT 'General',
  prioridad       SMALLINT      NOT NULL DEFAULT 2,
  estado          VARCHAR(12)   NOT NULL DEFAULT 'Pendiente',
  minutos_invertidos INTEGER    NOT NULL DEFAULT 0,
  fecha_limite    DATE          NOT NULL,
  fecha_creacion  DATE          NOT NULL,
  fecha_cierre    DATE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT tareas_titulo_minimo    CHECK (char_length(btrim(titulo)) >= 1),  -- RN-06
  CONSTRAINT tareas_prioridad_valida CHECK (prioridad BETWEEN 1 AND 3),         -- RN-04
  CONSTRAINT tareas_estado_valido    CHECK (estado IN ('Pendiente', 'En Progreso', 'Completada')),
  CONSTRAINT tareas_minutos_validos  CHECK (minutos_invertidos >= 0),           -- RN-17
  CONSTRAINT tareas_cierre_coherente CHECK (
    (estado = 'Completada' AND fecha_cierre IS NOT NULL) OR
    (estado <> 'Completada' AND fecha_cierre IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_limite ON tareas_personales (fecha_limite);
CREATE INDEX IF NOT EXISTS idx_tareas_estado       ON tareas_personales (estado);

CREATE TABLE IF NOT EXISTS documentos (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_archivo  VARCHAR(255)  NOT NULL,
  categoria       VARCHAR(80)   NOT NULL DEFAULT 'General',
  num_fragmentos  INTEGER       NOT NULL DEFAULT 0,
  fecha_guardado  DATE          NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT documentos_nombre_minimo CHECK (char_length(btrim(nombre_archivo)) >= 1)
);

CREATE TABLE IF NOT EXISTS fragmentos_pdf (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id   UUID          NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  numero         INTEGER       NOT NULL,                 -- posición del fragmento en el documento
  contenido      TEXT          NOT NULL,
  vector         vector(768)   NOT NULL,                 -- embedding de Gemini (768 dimensiones)
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fragmentos_numero_valido CHECK (numero >= 1),
  CONSTRAINT fragmentos_unico_por_doc UNIQUE (documento_id, numero)
);

CREATE TABLE IF NOT EXISTS fuentes_web (      -- solo si se implementa la funcionalidad 4
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria      VARCHAR(80)   NOT NULL,
  url            TEXT          NOT NULL,
  extracto       TEXT          NOT NULL,
  fecha_guardado DATE          NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fuentes_categoria ON fuentes_web (categoria, created_at);
