-- M19 (PLAN_AMPLIACION 6.15, E10c): qué fragmentos usó cada respuesta, para "Explicar de otra manera" (RB-41)
-- y para seguir un capítulo largo (RB-40). Solo aditiva: los INSERT de master la dejan en NULL.
ALTER TABLE mensajes_chat ADD COLUMN IF NOT EXISTS contexto JSONB;
ALTER TABLE mensajes_chat ADD CONSTRAINT mensajes_contexto_objeto CHECK (contexto IS NULL OR jsonb_typeof(contexto) = 'object');
