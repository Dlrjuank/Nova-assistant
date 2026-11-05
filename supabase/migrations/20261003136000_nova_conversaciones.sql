-- M4: historial del chat del asistente (RN-20).
-- Son las primeras tablas de Nova con dueño: las tareas y los documentos no lo tienen (sección 3.3).
-- La pantalla muestra solo la conversación más reciente, pero el modelo admite varias por usuario para
-- poder listarlas después sin otra migración.
CREATE TABLE IF NOT EXISTS conversaciones (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  creada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizada_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Destino de la clave foránea compuesta de mensajes_chat.
  CONSTRAINT conversaciones_id_usuario UNIQUE (id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario ON conversaciones (usuario_id, actualizada_en DESC);

-- La clave foránea compuesta impide guardar un mensaje con un usuario distinto al de su conversación.
-- El id autoincremental fija el orden: la pregunta y la respuesta se guardan en la misma transacción
-- y comparten el mismo now().
CREATE TABLE IF NOT EXISTS mensajes_chat (
  id               BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversacion_id  UUID        NOT NULL,
  usuario_id       UUID        NOT NULL,
  autor            TEXT        NOT NULL,
  texto            TEXT        NOT NULL,
  fuentes          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mensajes_conversacion FOREIGN KEY (conversacion_id, usuario_id)
    REFERENCES conversaciones (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT mensajes_autor_valido   CHECK (autor IN ('usuario', 'asistente')),
  CONSTRAINT mensajes_texto_no_vacio CHECK (char_length(btrim(texto)) >= 1),
  CONSTRAINT mensajes_fuentes_lista  CHECK (jsonb_typeof(fuentes) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_mensajes_chat_conversacion ON mensajes_chat (conversacion_id, id);

-- Igual que las demás tablas de Nova: RLS sin políticas; solo el servidor accede por la conexión directa.
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_chat  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON conversaciones, mensajes_chat FROM anon, authenticated;
