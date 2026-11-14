-- M23 (PLAN_AMPLIACION 6.19, 7.14; E11e): tareas creadas sin conexión.
-- El dispositivo le da a cada tarea creada sin conexión un identificador propio (id_cliente). Con él, un reintento
-- después de un corte o dos pestañas que envían a la vez nunca duplican la tarea: el índice único por usuario lo
-- impide en la base. Solo aditiva: las tareas creadas con conexión y las de master quedan con id_cliente en NULL.

ALTER TABLE tareas_personales ADD COLUMN IF NOT EXISTS id_cliente UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tareas_id_cliente
  ON tareas_personales (usuario_id, id_cliente)
  WHERE id_cliente IS NOT NULL;
