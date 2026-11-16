-- M9 (PLAN_AMPLIACION 6.5, 7.7; RB-14, RB-15; E14): fallas de cada materia.
-- Solo aditiva: dos columnas en materias (que master no usa). fallas_limite NULL = sin límite registrado.

ALTER TABLE materias ADD COLUMN IF NOT EXISTS fallas_limite SMALLINT NULL;
ALTER TABLE materias ADD COLUMN IF NOT EXISTS fallas_registradas SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE materias DROP CONSTRAINT IF EXISTS materias_fallas_limite_valido;
ALTER TABLE materias ADD CONSTRAINT materias_fallas_limite_valido CHECK (fallas_limite IS NULL OR fallas_limite >= 0); -- RB-15
ALTER TABLE materias DROP CONSTRAINT IF EXISTS materias_fallas_registradas_validas;
ALTER TABLE materias ADD CONSTRAINT materias_fallas_registradas_validas CHECK (fallas_registradas >= 0); -- RB-15
