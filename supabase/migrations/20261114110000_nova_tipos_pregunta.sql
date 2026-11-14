-- M22 (PLAN_AMPLIACION 6.18, 7.12, RB-64 a RB-69; E10g): tipos de pregunta en los cuestionarios.
-- Solo agrega columnas y relaja restricciones: no se borra ni se cambia ningún dato. Las filas existentes quedan
-- como selección única ('unica') y sus respuestas reciben los puntos (100 o 0) según su acierto, para que el
-- puntaje se calcule igual. master no usa estas tablas.

-- Cuestionarios: el tipo elegido al crear.
ALTER TABLE cuestionarios ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'unica';
ALTER TABLE cuestionarios DROP CONSTRAINT IF EXISTS cuestionarios_tipo_valido;
ALTER TABLE cuestionarios ADD CONSTRAINT cuestionarios_tipo_valido
  CHECK (tipo IN ('unica', 'multiple', 'vf', 'completar', 'abierta', 'mixto'));

-- Preguntas: el tipo y los campos de cada tipo.
--   correctas: las posiciones correctas de una múltiple (2 o 3, distintas, de 0 a 3).
--   verdadero: si la afirmación de verdadero o falso es verdadera.
--   respuesta_texto: en completar, lo que falta (1 a 40 caracteres); en abierta, la respuesta modelo (20 a 400).
ALTER TABLE preguntas_cuestionario ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'unica';
ALTER TABLE preguntas_cuestionario ADD COLUMN IF NOT EXISTS correctas SMALLINT[] NULL;
ALTER TABLE preguntas_cuestionario ADD COLUMN IF NOT EXISTS verdadero BOOLEAN NULL;
ALTER TABLE preguntas_cuestionario ADD COLUMN IF NOT EXISTS respuesta_texto TEXT NULL;
ALTER TABLE preguntas_cuestionario ALTER COLUMN opciones DROP NOT NULL;
ALTER TABLE preguntas_cuestionario ALTER COLUMN correcta DROP NOT NULL;
-- Las de 4 opciones y correcta de 0 a 3 pasan al CHECK por tipo, que las filas existentes ya cumplen.
ALTER TABLE preguntas_cuestionario DROP CONSTRAINT IF EXISTS preguntas_cuatro_opciones;
ALTER TABLE preguntas_cuestionario DROP CONSTRAINT IF EXISTS preguntas_correcta_valida;
ALTER TABLE preguntas_cuestionario DROP CONSTRAINT IF EXISTS preguntas_tipo_valido;
ALTER TABLE preguntas_cuestionario ADD CONSTRAINT preguntas_tipo_valido CHECK (
  CASE tipo
    WHEN 'unica' THEN
      jsonb_typeof(opciones) = 'array' AND jsonb_array_length(opciones) = 4
      AND correcta BETWEEN 0 AND 3
      AND correctas IS NULL AND verdadero IS NULL AND respuesta_texto IS NULL
    WHEN 'multiple' THEN
      jsonb_typeof(opciones) = 'array' AND jsonb_array_length(opciones) = 4
      AND correcta IS NULL AND verdadero IS NULL AND respuesta_texto IS NULL
      AND array_ndims(correctas) = 1 AND array_position(correctas, NULL) IS NULL
      AND correctas <@ ARRAY[0, 1, 2, 3]::SMALLINT[]
      AND (
        (cardinality(correctas) = 2 AND correctas[1] <> correctas[2])
        OR (cardinality(correctas) = 3 AND correctas[1] <> correctas[2] AND correctas[1] <> correctas[3] AND correctas[2] <> correctas[3])
      )
    WHEN 'vf' THEN
      verdadero IS NOT NULL
      AND opciones IS NULL AND correcta IS NULL AND correctas IS NULL AND respuesta_texto IS NULL
    WHEN 'completar' THEN
      char_length(respuesta_texto) BETWEEN 1 AND 40
      AND opciones IS NULL AND correcta IS NULL AND correctas IS NULL AND verdadero IS NULL
    WHEN 'abierta' THEN
      char_length(respuesta_texto) BETWEEN 20 AND 400
      AND opciones IS NULL AND correcta IS NULL AND correctas IS NULL AND verdadero IS NULL
    ELSE FALSE
  END
);

-- Respuestas: lo que se respondió según el tipo y los puntos de la pregunta.
--   elegida: la opción de una única; en verdadero o falso, 1 = Verdadero y 0 = Falso.
--   elegidas: las opciones marcadas de una múltiple.
--   texto: lo escrito en completar o abierta (hasta 1000 caracteres).
--   autoevaluacion: la calificación de una abierta.
--   puntos: centésimas de punto de la pregunta (0 a 100); en una abierta, NULL hasta la autoevaluación.
ALTER TABLE respuestas_intento ADD COLUMN IF NOT EXISTS elegidas SMALLINT[] NULL;
ALTER TABLE respuestas_intento ADD COLUMN IF NOT EXISTS texto TEXT NULL;
ALTER TABLE respuestas_intento ADD COLUMN IF NOT EXISTS autoevaluacion TEXT NULL;
ALTER TABLE respuestas_intento ADD COLUMN IF NOT EXISTS puntos SMALLINT NULL;
ALTER TABLE respuestas_intento ALTER COLUMN elegida DROP NOT NULL;
ALTER TABLE respuestas_intento ALTER COLUMN acierto DROP NOT NULL;

UPDATE respuestas_intento SET puntos = CASE WHEN acierto THEN 100 ELSE 0 END WHERE puntos IS NULL AND acierto IS NOT NULL;

ALTER TABLE respuestas_intento DROP CONSTRAINT IF EXISTS respuestas_puntos_validos;
ALTER TABLE respuestas_intento ADD CONSTRAINT respuestas_puntos_validos CHECK (
  (puntos IS NULL AND acierto IS NULL)
  OR (puntos BETWEEN 0 AND 100 AND acierto IS NOT NULL AND acierto = (puntos = 100))
);
ALTER TABLE respuestas_intento DROP CONSTRAINT IF EXISTS respuestas_elegidas_validas;
ALTER TABLE respuestas_intento ADD CONSTRAINT respuestas_elegidas_validas CHECK (
  elegidas IS NULL
  OR (array_ndims(elegidas) = 1 AND cardinality(elegidas) BETWEEN 1 AND 4 AND array_position(elegidas, NULL) IS NULL AND elegidas <@ ARRAY[0, 1, 2, 3]::SMALLINT[])
);
ALTER TABLE respuestas_intento DROP CONSTRAINT IF EXISTS respuestas_texto_valido;
ALTER TABLE respuestas_intento ADD CONSTRAINT respuestas_texto_valido CHECK (texto IS NULL OR char_length(texto) BETWEEN 1 AND 1000);
ALTER TABLE respuestas_intento DROP CONSTRAINT IF EXISTS respuestas_autoevaluacion_valida;
ALTER TABLE respuestas_intento ADD CONSTRAINT respuestas_autoevaluacion_valida CHECK (
  autoevaluacion IS NULL
  OR (autoevaluacion = 'bien' AND puntos = 100)
  OR (autoevaluacion = 'medias' AND puntos = 50)
  OR (autoevaluacion = 'mal' AND puntos = 0)
);
-- Toda respuesta guarda algo de lo respondido.
ALTER TABLE respuestas_intento DROP CONSTRAINT IF EXISTS respuestas_con_valor;
ALTER TABLE respuestas_intento ADD CONSTRAINT respuestas_con_valor CHECK (elegida IS NOT NULL OR elegidas IS NOT NULL OR texto IS NOT NULL);
