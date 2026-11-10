-- M21 (PLAN_AMPLIACION 6.17, E10c2): de dónde salió cada mensaje, para que el modelo reciba solo el historial
-- del mismo origen (RB-61). NULL = documentos y tareas, como todo lo anterior. Solo aditiva: los INSERT de master la dejan en NULL.
ALTER TABLE mensajes_chat ADD COLUMN IF NOT EXISTS origen TEXT;

ALTER TABLE mensajes_chat DROP CONSTRAINT IF EXISTS mensajes_origen_valido;
ALTER TABLE mensajes_chat ADD CONSTRAINT mensajes_origen_valido CHECK (origen IN ('web', 'wikipedia', 'ia'));
