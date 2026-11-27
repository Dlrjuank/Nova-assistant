-- M27 (E21, PLAN_AMPLIACION 6.1): quita el dueño por defecto de M5 y hace obligatorio usuario_id.
-- PENDIENTE: no está en supabase/migrations/ a propósito (db:migrar aplica todo lo que haya allí).
-- Se aplica entre 24 y 48 horas después de que master tenga el código nuevo, nunca antes: el código anterior
-- (6ce9a4d y v1-original) inserta sin usuario_id y dejaría de poder guardar. Pasos en supabase/pendientes/README.md.
-- Reverso: supabase/reversos/M27_reverso.sql.

-- 1. Nada sin dueño: si hubiera una fila, db:migrar revierte todo y la base queda como estaba.
DO $$
DECLARE
  sin_dueno BIGINT;
BEGIN
  SELECT (SELECT count(*) FROM tareas_personales WHERE usuario_id IS NULL)
       + (SELECT count(*) FROM documentos WHERE usuario_id IS NULL)
       + (SELECT count(*) FROM fuentes_web WHERE usuario_id IS NULL)
    INTO sin_dueno;
  IF sin_dueno > 0 THEN
    RAISE EXCEPTION 'M27: hay % filas sin usuario_id; asígneles dueño antes de continuar', sin_dueno;
  END IF;
END $$;

-- 2. El disparador, su función y la tabla que solo ellos usaban.
DROP TRIGGER IF EXISTS tareas_dueno_por_defecto     ON tareas_personales;
DROP TRIGGER IF EXISTS documentos_dueno_por_defecto ON documentos;
DROP TRIGGER IF EXISTS fuentes_dueno_por_defecto    ON fuentes_web;
DROP FUNCTION IF EXISTS asignar_dueno_por_defecto();
DROP TABLE IF EXISTS nova_config;

-- 3. Desde ahora toda fila tiene dueño.
ALTER TABLE tareas_personales ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE documentos        ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE fuentes_web       ALTER COLUMN usuario_id SET NOT NULL;
