-- M5 (ampliación, E01): dueño (usuario_id) en tareas, documentos y fuentes web.
-- Solo aditiva: el código de master, que sigue en producción con esta misma base, no envía usuario_id;
-- el disparador se lo pone. No se toca ninguna columna existente ni la función buscar_fragmentos.
-- TEMPORAL: el disparador y nova_config se quitan al unir ampliacion con master (PLAN_AMPLIACION 6.1, E21).

-- 1. Dueño por defecto: la cuenta del correo incorporado en src/modules/auth/admin.ts.
CREATE TABLE IF NOT EXISTS nova_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
ALTER TABLE nova_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nova_config FROM anon, authenticated;

DO $$
DECLARE
  dueno UUID;
BEGIN
  SELECT id INTO dueno FROM auth.users WHERE lower(email) = lower('juandelarosa1617@gmail.com');
  IF dueno IS NULL THEN
    -- db:migrar revierte la transacción: la base queda como estaba.
    RAISE EXCEPTION 'M5: no existe en auth.users la cuenta del correo incorporado; créela e intente de nuevo';
  END IF;
  INSERT INTO nova_config (clave, valor) VALUES ('dueno_por_defecto', dueno::text)
  ON CONFLICT (clave) DO NOTHING;
END $$;

-- 2. Columna de dueño, nullable: si faltara nova_config, los INSERT de master no fallan.
ALTER TABLE tareas_personales ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE documentos        ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE fuentes_web       ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;

-- 3. Lo que ya existe pasa al dueño por defecto.
UPDATE tareas_personales SET usuario_id = (SELECT valor::uuid FROM nova_config WHERE clave = 'dueno_por_defecto') WHERE usuario_id IS NULL;
UPDATE documentos        SET usuario_id = (SELECT valor::uuid FROM nova_config WHERE clave = 'dueno_por_defecto') WHERE usuario_id IS NULL;
UPDATE fuentes_web       SET usuario_id = (SELECT valor::uuid FROM nova_config WHERE clave = 'dueno_por_defecto') WHERE usuario_id IS NULL;

-- 4. Compatibilidad con master: un INSERT sin usuario_id recibe el dueño por defecto.
--    El código nuevo siempre envía usuario_id, así que el disparador no lo cambia.
CREATE OR REPLACE FUNCTION asignar_dueno_por_defecto() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.usuario_id IS NULL THEN
    NEW.usuario_id := (SELECT valor::uuid FROM nova_config WHERE clave = 'dueno_por_defecto');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tareas_dueno_por_defecto     ON tareas_personales;
DROP TRIGGER IF EXISTS documentos_dueno_por_defecto ON documentos;
DROP TRIGGER IF EXISTS fuentes_dueno_por_defecto    ON fuentes_web;
CREATE TRIGGER tareas_dueno_por_defecto     BEFORE INSERT ON tareas_personales FOR EACH ROW EXECUTE FUNCTION asignar_dueno_por_defecto();
CREATE TRIGGER documentos_dueno_por_defecto BEFORE INSERT ON documentos        FOR EACH ROW EXECUTE FUNCTION asignar_dueno_por_defecto();
CREATE TRIGGER fuentes_dueno_por_defecto    BEFORE INSERT ON fuentes_web       FOR EACH ROW EXECUTE FUNCTION asignar_dueno_por_defecto();

-- 5. Índices para las consultas por usuario.
CREATE INDEX IF NOT EXISTS idx_tareas_usuario     ON tareas_personales (usuario_id, fecha_limite);
CREATE INDEX IF NOT EXISTS idx_documentos_usuario ON documentos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_fuentes_usuario    ON fuentes_web (usuario_id, categoria, created_at);

-- 6. Búsqueda por usuario. buscar_fragmentos se conserva sin cambios para master.
--    Con el filtro por dueño, el índice HNSW podría devolver menos filas de las pedidas;
--    iterative_scan (pgvector 0.8) sigue buscando hasta completar el límite, en orden estricto.
--    Se fija con set_config(..., true), que solo dura la transacción: Supabase no permite la cláusula
--    SET en la definición de la función ("permission denied to set parameter").
CREATE OR REPLACE FUNCTION buscar_fragmentos_usuario(consulta vector(768), limite int, usuario UUID)
RETURNS TABLE (
  id UUID, documento_id UUID, numero int, contenido text,
  nombre_archivo varchar, distancia float
)
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  PERFORM set_config('hnsw.iterative_scan', 'strict_order', true);
  RETURN QUERY
    SELECT f.id, f.documento_id, f.numero, f.contenido,
           d.nombre_archivo,
           (f.vector <=> consulta)::float AS distancia
    FROM fragmentos_pdf f
    JOIN documentos d ON d.id = f.documento_id
    WHERE d.usuario_id = usuario
    ORDER BY f.vector <=> consulta
    LIMIT limite;
END $$;
