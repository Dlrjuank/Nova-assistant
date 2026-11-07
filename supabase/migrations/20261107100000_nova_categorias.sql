-- M6 (ampliación, E05): categorías de tareas con color, por usuario (PLAN_AMPLIACION 6.2, RB-02 a RB-04).
-- Solo aditiva: el código de master no conoce esta tabla; las tareas siguen guardando la categoría como texto
-- (tareas_personales.categoria) y el color se busca por nombre, sin distinguir mayúsculas.

CREATE TABLE IF NOT EXISTS categorias (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre      VARCHAR(80) NOT NULL,
  color       TEXT        NOT NULL,
  creada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Nombre recortado y no vacío (RB-02); color de la paleta fija de 8 (RB-03, PLAN_AMPLIACION 3.1).
  CONSTRAINT categorias_nombre_valido CHECK (nombre = btrim(nombre) AND char_length(nombre) BETWEEN 1 AND 80),
  CONSTRAINT categorias_color_valido CHECK (color IN ('terracota', 'ambar', 'oliva', 'verde', 'azul', 'violeta', 'rosa', 'gris')),
  -- Destino de futuras claves foráneas compuestas (id, usuario_id).
  CONSTRAINT categorias_id_usuario UNIQUE (id, usuario_id)
);

-- Un nombre por usuario, sin distinguir mayúsculas (RB-02).
CREATE UNIQUE INDEX IF NOT EXISTS categorias_nombre_unico ON categorias (usuario_id, lower(nombre));

-- Igual que las demás tablas de Nova: RLS sin políticas; solo el servidor accede por la conexión directa.
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON categorias FROM anon, authenticated;

-- Siembra: por cada usuario con tareas, "General" (gris) y una categoría por cada nombre ya usado,
-- con los colores de la paleta en orden (sin gris, que queda para General y lo no registrado).
WITH usados AS (
  -- Si se escribió con mayúsculas distintas, se toma como se escribió la primera vez.
  SELECT usuario_id, (array_agg(btrim(categoria) ORDER BY created_at, id))[1] AS nombre
  FROM tareas_personales
  WHERE usuario_id IS NOT NULL AND btrim(categoria) <> '' AND lower(btrim(categoria)) <> 'general'
  GROUP BY usuario_id, lower(btrim(categoria))
),
numerados AS (
  SELECT usuario_id, left(nombre, 80) AS nombre,
         (ARRAY['terracota', 'ambar', 'oliva', 'verde', 'azul', 'violeta', 'rosa'])
           [((row_number() OVER (PARTITION BY usuario_id ORDER BY lower(nombre)) - 1) % 7) + 1] AS color
  FROM usados
)
INSERT INTO categorias (usuario_id, nombre, color)
SELECT DISTINCT usuario_id, 'General', 'gris' FROM tareas_personales WHERE usuario_id IS NOT NULL
UNION ALL
SELECT usuario_id, nombre, color FROM numerados
ON CONFLICT DO NOTHING;
