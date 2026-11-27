-- Reverso de M27: devuelve la base al estado en que el código anterior a la ampliación puede guardar.
-- No se ejecuta con db:migrar. Se aplica con: node scripts/m27.mjs --revertir --confirmar

-- 1. nova_config con el dueño actual (M25 garantiza que es la cuenta del correo incorporado).
CREATE TABLE IF NOT EXISTS nova_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
ALTER TABLE nova_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nova_config FROM anon, authenticated;
INSERT INTO nova_config (clave, valor)
SELECT 'dueno_por_defecto', usuario_id::text FROM cuentas WHERE nivel = 'dueno'
ON CONFLICT (clave) DO NOTHING;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM nova_config WHERE clave = 'dueno_por_defecto') THEN
    RAISE EXCEPTION 'Reverso de M27: no hay cuenta con nivel dueño';
  END IF;
END $$;

-- 2. usuario_id vuelve a ser opcional.
ALTER TABLE tareas_personales ALTER COLUMN usuario_id DROP NOT NULL;
ALTER TABLE documentos        ALTER COLUMN usuario_id DROP NOT NULL;
ALTER TABLE fuentes_web       ALTER COLUMN usuario_id DROP NOT NULL;

-- 3. El disparador de M5, igual que antes.
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

-- 4. Así db:migrar la vuelve a ver como pendiente.
DELETE FROM _migrations WHERE nombre = '20261128100000_nova_quitar_dueno_por_defecto.sql';
