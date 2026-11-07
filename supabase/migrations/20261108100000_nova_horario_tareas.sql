-- M14 (ampliación, E06b): horario opcional de una tarea (RB-34). Solo aditiva: el código de master no
-- conoce estas columnas y sus INSERT las dejan en NULL.
ALTER TABLE tareas_personales ADD COLUMN IF NOT EXISTS hora_inicio TIME;
ALTER TABLE tareas_personales ADD COLUMN IF NOT EXISTS hora_fin    TIME;

-- RB-34: la hora de fin necesita una de inicio y debe ser posterior, dentro del mismo día.
-- (Se borra y se vuelve a crear para que la migración sea repetible.)
ALTER TABLE tareas_personales DROP CONSTRAINT IF EXISTS tareas_horario_valido;
ALTER TABLE tareas_personales ADD CONSTRAINT tareas_horario_valido CHECK (
  hora_fin IS NULL OR (hora_inicio IS NOT NULL AND hora_fin > hora_inicio)
);
