-- M11 (PLAN_AMPLIACION 6.7; E16): metas de nota de una materia o de uno de sus cortes. Solo aditiva y con RLS:
-- master no usa esta tabla. La meta va en centésimas (450 = 4,5), de 0,1 a 5,0 (RB-18). corte_id NULL = meta de
-- la materia. Las metas de corte solo existen en materias con cortes: el servidor lo exige y, al quitar los
-- cortes, las borra; al borrar un corte o la materia, la base las borra en cascada.

-- Para que la FK de abajo exija que el corte sea de esa misma materia.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cortes_id_materia') THEN
    ALTER TABLE cortes ADD CONSTRAINT cortes_id_materia UNIQUE (id, materia_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS metas_nota (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID          NOT NULL,
  materia_id  UUID          NOT NULL,
  corte_id    UUID,
  meta        SMALLINT      NOT NULL,
  creada_en   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT metas_nota_materia FOREIGN KEY (materia_id, usuario_id) REFERENCES materias (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT metas_nota_corte FOREIGN KEY (corte_id, usuario_id) REFERENCES cortes (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT metas_nota_corte_de_la_materia FOREIGN KEY (corte_id, materia_id) REFERENCES cortes (id, materia_id) ON DELETE CASCADE,
  CONSTRAINT metas_nota_meta_valida CHECK (meta BETWEEN 10 AND 500), -- RB-18
  CONSTRAINT metas_nota_unica UNIQUE NULLS NOT DISTINCT (materia_id, corte_id)
);
CREATE INDEX IF NOT EXISTS idx_metas_nota_usuario ON metas_nota (usuario_id);
ALTER TABLE metas_nota ENABLE ROW LEVEL SECURITY;
