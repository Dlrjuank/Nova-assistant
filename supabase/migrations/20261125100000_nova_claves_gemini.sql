-- M24 (PLAN_AMPLIACION 6.20, 7.15; E20c-1): la clave de Gemini de cada persona, cifrada, y el conteo de su uso.
-- Solo aditiva y con RLS sin políticas: solo el servidor las lee. master no las usa y sigue con GEMINI_API_KEY.
-- La clave nunca se guarda en claro ni con un hash que permita probar claves: solo el texto cifrado con AES-256-GCM,
-- su IV, su etiqueta y la versión de la llave con la que se cifró (NOVA_LLAVE_CLAVES_V{n}; cambios del 2026-11-25).
-- `ilegible`: no se pudo descifrar (por ejemplo, si se perdiera una versión de la llave); hay que vincularla otra vez.

CREATE TABLE IF NOT EXISTS claves_gemini (
  usuario_id     UUID         PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  cifrada        BYTEA        NOT NULL,
  iv             BYTEA        NOT NULL,
  etiqueta       BYTEA        NOT NULL,
  version_llave  SMALLINT     NOT NULL,
  ultimos4       CHAR(4)      NOT NULL,
  estado         VARCHAR(10)  NOT NULL DEFAULT 'activa',
  verificada_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizada_en TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT claves_gemini_iv_largo CHECK (octet_length(iv) = 12),
  CONSTRAINT claves_gemini_etiqueta_larga CHECK (octet_length(etiqueta) = 16),
  CONSTRAINT claves_gemini_cifrada_larga CHECK (octet_length(cifrada) BETWEEN 30 AND 200),
  CONSTRAINT claves_gemini_version_valida CHECK (version_llave BETWEEN 1 AND 999),
  CONSTRAINT claves_gemini_estado_valido CHECK (estado IN ('activa', 'rechazada', 'sin_cuota', 'ilegible'))
);
ALTER TABLE claves_gemini ENABLE ROW LEVEL SECURITY;

-- Solo conteos de llamadas a Gemini por cuenta y día de Bogotá, para "Administración" (nunca preguntas ni respuestas).
CREATE TABLE IF NOT EXISTS uso_ia_diario (
  usuario_id  UUID     NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  dia         DATE     NOT NULL,
  consultas   INTEGER  NOT NULL DEFAULT 0,
  CONSTRAINT uso_ia_diario_pk PRIMARY KEY (usuario_id, dia),
  CONSTRAINT uso_ia_diario_consultas_validas CHECK (consultas >= 0)
);
ALTER TABLE uso_ia_diario ENABLE ROW LEVEL SECURITY;
