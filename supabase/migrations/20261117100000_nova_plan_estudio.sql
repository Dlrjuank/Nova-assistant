-- M13 (PLAN_AMPLIACION 6.9; E18, E19): plan de estudio de un corte, con sus versiones, y los pasos pasados a Tareas.
-- Solo aditiva y con RLS: master no usa estas tablas. Un plan por corte (una materia sin cortes usa su corte único).
-- Nunca se modifica una versión: editar o restaurar crea una nueva; la vigente es la de mayor número. El contenido
-- (semanas, días y pasos, 9.3) lo valida el servidor antes de guardarlo; aquí solo se exige que sea un objeto.
-- Al borrar el corte o la materia, la base borra el plan, sus versiones y sus marcas de "En Tareas" (la tarea queda).

CREATE TABLE IF NOT EXISTS planes_estudio (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID         NOT NULL,
  corte_id    UUID         NOT NULL,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT planes_estudio_corte_unico UNIQUE (corte_id),
  CONSTRAINT planes_estudio_dueno UNIQUE (id, usuario_id),
  CONSTRAINT planes_estudio_corte FOREIGN KEY (corte_id, usuario_id) REFERENCES cortes (id, usuario_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_planes_estudio_usuario ON planes_estudio (usuario_id);
ALTER TABLE planes_estudio ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS versiones_plan (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID         NOT NULL,
  usuario_id  UUID         NOT NULL,
  numero      INTEGER      NOT NULL,
  origen      VARCHAR(10)  NOT NULL,
  contenido   JSONB        NOT NULL,
  huella      JSONB        NOT NULL,
  creada_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT versiones_plan_numero UNIQUE (plan_id, numero),
  CONSTRAINT versiones_plan_plan FOREIGN KEY (plan_id, usuario_id) REFERENCES planes_estudio (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT versiones_plan_numero_valido CHECK (numero >= 1),
  CONSTRAINT versiones_plan_origen_valido CHECK (origen IN ('asistente', 'manual', 'restaurada')),
  CONSTRAINT versiones_plan_contenido_objeto CHECK (jsonb_typeof(contenido) = 'object' AND COALESCE(jsonb_typeof(contenido -> 'semanas'), '') = 'array'),
  CONSTRAINT versiones_plan_huella_objeto CHECK (jsonb_typeof(huella) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_versiones_plan_usuario ON versiones_plan (usuario_id);
ALTER TABLE versiones_plan ENABLE ROW LEVEL SECURITY;

-- E19 (9.5, RB-24): un paso pasa a Tareas una sola vez. Los pasos conservan su id entre versiones.
CREATE TABLE IF NOT EXISTS pasos_en_tareas (
  plan_id     UUID  NOT NULL,
  paso_id     UUID  NOT NULL,
  tarea_id    UUID  NOT NULL REFERENCES tareas_personales (id) ON DELETE CASCADE,
  usuario_id  UUID  NOT NULL,
  CONSTRAINT pasos_en_tareas_pk PRIMARY KEY (plan_id, paso_id),
  CONSTRAINT pasos_en_tareas_plan FOREIGN KEY (plan_id, usuario_id) REFERENCES planes_estudio (id, usuario_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pasos_en_tareas_usuario ON pasos_en_tareas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_pasos_en_tareas_tarea ON pasos_en_tareas (tarea_id);
ALTER TABLE pasos_en_tareas ENABLE ROW LEVEL SECURITY;
