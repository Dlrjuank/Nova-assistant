-- M7 (PLAN_AMPLIACION 6.3, E11): preferencias del usuario. Sin fila, se usan los valores por defecto.
-- Solo aditiva y con RLS: master no usa esta tabla. El nombre del perfil sigue en public.users.full_name.
-- formato_hora (24 o 12 horas) lo pidió el usuario en E06b; la tabla del plan no lo traía.

-- Cortes por defecto (centésimas de punto porcentual): de 1 a 6 cortes, cada uno mayor que 0, y suman 10000.
-- Un CHECK no admite subconsultas: por eso una función inmutable.
CREATE OR REPLACE FUNCTION nova_cortes_validos(cortes INTEGER[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT cardinality(cortes) BETWEEN 1 AND 6
     AND NOT EXISTS (SELECT 1 FROM unnest(cortes) AS c WHERE c IS NULL OR c <= 0)
     AND (SELECT sum(c) FROM unnest(cortes) AS c) = 10000;
$$;

CREATE TABLE IF NOT EXISTS preferencias_usuario (
  usuario_id      UUID          PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  tema            TEXT          NOT NULL DEFAULT 'automatico',
  formato_hora    TEXT          NOT NULL DEFAULT '24',
  nota_aprobar    NUMERIC(3,2)  NOT NULL DEFAULT 3.00,
  redondeo        TEXT          NOT NULL DEFAULT 'truncar',
  cortes_defecto  INTEGER[]     NOT NULL DEFAULT '{3000,3000,4000}',
  actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT preferencias_tema_valido CHECK (tema IN ('claro', 'oscuro', 'automatico')),          -- RB-27
  CONSTRAINT preferencias_formato_hora_valido CHECK (formato_hora IN ('24', '12')),
  CONSTRAINT preferencias_nota_aprobar_valida CHECK (nota_aprobar BETWEEN 0 AND 5),               -- RB-11
  CONSTRAINT preferencias_redondeo_valido CHECK (redondeo IN ('truncar', 'redondear')),
  CONSTRAINT preferencias_cortes_validos CHECK (nova_cortes_validos(cortes_defecto))
);

-- Igual que las demás tablas de Nova: RLS sin políticas; solo el servidor accede por la conexión directa.
ALTER TABLE preferencias_usuario ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON preferencias_usuario FROM anon, authenticated;
