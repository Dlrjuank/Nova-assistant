-- M8 (PLAN_AMPLIACION 6.4; E12): Semestre. Materia → cortes (opcionales) → componentes de evaluación → notas.
-- Solo aditiva y con RLS: master no usa estas tablas. Notas y porcentajes en centésimas (enteros) para calcular
-- sin errores de coma flotante: 375 = 3,75; 3000 = 30 %. Una materia sin cortes tiene internamente un corte
-- único de 100 % que la pantalla no muestra. Las sumas de porcentajes no tienen CHECK: si no dan 100 %, la
-- pantalla avisa (RB-07, RB-08) sin impedir guardar.

CREATE TABLE IF NOT EXISTS materias (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID          NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre      VARCHAR(80)   NOT NULL,
  creditos    SMALLINT      NOT NULL,
  docente     VARCHAR(120),
  usa_cortes  BOOLEAN       NOT NULL DEFAULT false,
  creada_en   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT materias_id_usuario UNIQUE (id, usuario_id),
  CONSTRAINT materias_nombre_valido CHECK (char_length(btrim(nombre)) >= 1),
  CONSTRAINT materias_creditos_validos CHECK (creditos BETWEEN 1 AND 10) -- RB-06
);
-- RB-05: nombre único por usuario, sin distinguir mayúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_materias_nombre ON materias (usuario_id, lower(nombre));
ALTER TABLE materias ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cortes (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_id  UUID         NOT NULL,
  usuario_id  UUID         NOT NULL,
  orden       SMALLINT     NOT NULL,
  nombre      VARCHAR(40)  NOT NULL,
  porcentaje  INTEGER      NOT NULL, -- centésimas: 3000 = 30 %
  fecha       DATE,
  CONSTRAINT cortes_materia FOREIGN KEY (materia_id, usuario_id) REFERENCES materias (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT cortes_id_usuario UNIQUE (id, usuario_id),
  CONSTRAINT cortes_orden_unico UNIQUE (materia_id, orden),
  CONSTRAINT cortes_nombre_valido CHECK (char_length(btrim(nombre)) >= 1),
  CONSTRAINT cortes_porcentaje_valido CHECK (porcentaje BETWEEN 1 AND 10000)
);
CREATE INDEX IF NOT EXISTS idx_cortes_materia ON cortes (materia_id);
ALTER TABLE cortes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS componentes (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  corte_id    UUID         NOT NULL,
  usuario_id  UUID         NOT NULL,
  orden       SMALLINT     NOT NULL,
  nombre      VARCHAR(80)  NOT NULL,
  porcentaje  INTEGER      NOT NULL, -- centésimas, dentro de su corte
  CONSTRAINT componentes_corte FOREIGN KEY (corte_id, usuario_id) REFERENCES cortes (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT componentes_id_usuario UNIQUE (id, usuario_id),
  CONSTRAINT componentes_nombre_valido CHECK (char_length(btrim(nombre)) >= 1),
  CONSTRAINT componentes_porcentaje_valido CHECK (porcentaje BETWEEN 1 AND 10000) -- RB-10
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_componentes_nombre ON componentes (corte_id, lower(nombre));
ALTER TABLE componentes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS notas (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  componente_id  UUID          NOT NULL,
  usuario_id     UUID          NOT NULL,
  orden          SMALLINT      NOT NULL,
  nombre         VARCHAR(120),
  nota           SMALLINT, -- centésimas, 0 a 500; NULL = "sin nota" (pendiente)
  fecha          DATE,
  CONSTRAINT notas_componente FOREIGN KEY (componente_id, usuario_id) REFERENCES componentes (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT notas_valor_valido CHECK (nota IS NULL OR nota BETWEEN 0 AND 500) -- RB-09
);
CREATE INDEX IF NOT EXISTS idx_notas_componente ON notas (componente_id);
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;

-- Un documento puede pertenecer a una materia del mismo usuario (E13). Al borrar la materia, el documento queda
-- sin materia y conserva su dueño.
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS materia_id UUID NULL;
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_materia;
ALTER TABLE documentos ADD CONSTRAINT documentos_materia FOREIGN KEY (materia_id, usuario_id)
  REFERENCES materias (id, usuario_id) ON DELETE SET NULL (materia_id);
