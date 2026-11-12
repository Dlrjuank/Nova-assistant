-- M17 (PLAN_AMPLIACION 6.13, E10e y E10f): cuestionarios de selección múltiple que salen de un documento.
-- Solo aditiva y con RLS: master no usa estas tablas. Al eliminar un documento se borran sus cuestionarios e intentos.

CREATE TABLE IF NOT EXISTS cuestionarios (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID         NOT NULL,
  documento_id  UUID         NOT NULL,
  capitulo_id   UUID         REFERENCES capitulos (id) ON DELETE SET NULL,
  pagina_desde  SMALLINT,
  pagina_hasta  SMALLINT,
  alcance       TEXT         NOT NULL,
  dificultad    TEXT         NOT NULL,
  pedidas       SMALLINT     NOT NULL,
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT cuestionarios_documento FOREIGN KEY (documento_id, usuario_id)
    REFERENCES documentos (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT cuestionarios_id_usuario UNIQUE (id, usuario_id),
  CONSTRAINT cuestionarios_alcance_valido CHECK (alcance IN ('documento', 'capitulo', 'paginas')),
  CONSTRAINT cuestionarios_dificultad_valida CHECK (dificultad IN ('facil', 'media', 'dificil')),
  CONSTRAINT cuestionarios_pedidas_validas CHECK (pedidas IN (5, 10, 20)),
  CONSTRAINT cuestionarios_paginas_validas CHECK (
    (alcance <> 'paginas' AND pagina_desde IS NULL AND pagina_hasta IS NULL)
    OR (alcance = 'paginas' AND pagina_desde >= 1 AND pagina_hasta >= pagina_desde)
  )
);
CREATE INDEX IF NOT EXISTS idx_cuestionarios_usuario ON cuestionarios (usuario_id, documento_id);
ALTER TABLE cuestionarios ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS preguntas_cuestionario (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cuestionario_id   UUID          NOT NULL,
  usuario_id        UUID          NOT NULL,
  orden             SMALLINT      NOT NULL,
  enunciado         VARCHAR(400)  NOT NULL,
  opciones          JSONB         NOT NULL,
  correcta          SMALLINT      NOT NULL,
  explicacion       VARCHAR(400)  NOT NULL,
  cita_textual      TEXT          NOT NULL,
  etiqueta_paginas  TEXT,
  capitulo_id       UUID          REFERENCES capitulos (id) ON DELETE SET NULL,
  CONSTRAINT preguntas_cuestionario FOREIGN KEY (cuestionario_id, usuario_id)
    REFERENCES cuestionarios (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT preguntas_id_usuario UNIQUE (id, usuario_id),
  CONSTRAINT preguntas_orden_unico UNIQUE (cuestionario_id, orden),
  CONSTRAINT preguntas_correcta_valida CHECK (correcta BETWEEN 0 AND 3),
  CONSTRAINT preguntas_cuatro_opciones CHECK (jsonb_typeof(opciones) = 'array' AND jsonb_array_length(opciones) = 4)
);
ALTER TABLE preguntas_cuestionario ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS intentos_cuestionario (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cuestionario_id  UUID         NOT NULL,
  usuario_id       UUID         NOT NULL,
  preguntas        UUID[]       NOT NULL,
  repaso_de        UUID         REFERENCES intentos_cuestionario (id) ON DELETE SET NULL,
  aciertos         SMALLINT,
  total            SMALLINT     NOT NULL,
  puntaje          SMALLINT,    -- centésimas, 0 a 500 (PLAN_AMPLIACION 7.11)
  iniciado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  terminado_en     TIMESTAMPTZ,
  CONSTRAINT intentos_cuestionario FOREIGN KEY (cuestionario_id, usuario_id)
    REFERENCES cuestionarios (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT intentos_id_usuario UNIQUE (id, usuario_id),
  CONSTRAINT intentos_total_valido CHECK (total >= 1 AND total = cardinality(preguntas)),
  CONSTRAINT intentos_puntaje_valido CHECK (puntaje IS NULL OR puntaje BETWEEN 0 AND 500),
  CONSTRAINT intentos_aciertos_validos CHECK (aciertos IS NULL OR aciertos BETWEEN 0 AND total)
);
CREATE INDEX IF NOT EXISTS idx_intentos_cuestionario ON intentos_cuestionario (cuestionario_id, iniciado_en);
ALTER TABLE intentos_cuestionario ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS respuestas_intento (
  intento_id     UUID         NOT NULL,
  pregunta_id    UUID         NOT NULL,
  usuario_id     UUID         NOT NULL,
  elegida        SMALLINT     NOT NULL,
  acierto        BOOLEAN      NOT NULL,
  respondida_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (intento_id, pregunta_id), -- RB-51: una respuesta no se cambia
  CONSTRAINT respuestas_intento FOREIGN KEY (intento_id, usuario_id)
    REFERENCES intentos_cuestionario (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT respuestas_pregunta FOREIGN KEY (pregunta_id, usuario_id)
    REFERENCES preguntas_cuestionario (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT respuestas_elegida_valida CHECK (elegida BETWEEN 0 AND 3)
);
ALTER TABLE respuestas_intento ENABLE ROW LEVEL SECURITY;
