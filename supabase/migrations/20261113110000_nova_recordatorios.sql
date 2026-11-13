-- M16 (PLAN_AMPLIACION 6.12, E11c): recordatorios con notificaciones push.
-- Solo aditiva: los INSERT de master dejan recordatorio en NULL y no avisan. Las tablas nuevas, con RLS sin
-- políticas como las demás de Nova: solo el servidor accede por la conexión directa.

-- 1. Recordatorio de cada tarea (RB-43). recordatorio_en lo calcula el servidor (regla 7.10).
ALTER TABLE tareas_personales ADD COLUMN IF NOT EXISTS recordatorio TEXT NULL;
ALTER TABLE tareas_personales ADD COLUMN IF NOT EXISTS recordatorio_en TIMESTAMPTZ NULL;
ALTER TABLE tareas_personales ADD COLUMN IF NOT EXISTS recordatorio_estado TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tareas_recordatorio_valido') THEN
    ALTER TABLE tareas_personales ADD CONSTRAINT tareas_recordatorio_valido
      CHECK (recordatorio IS NULL OR recordatorio IN ('a_la_hora', '15_min', '1_hora', '1_dia'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tareas_recordatorio_estado_valido') THEN
    ALTER TABLE tareas_personales ADD CONSTRAINT tareas_recordatorio_estado_valido
      CHECK (recordatorio_estado IS NULL OR recordatorio_estado IN ('pendiente', 'enviado', 'omitido'));
  END IF;
  -- Sin horario solo hay "El mismo día" (a_la_hora) y "El día anterior" (1_dia).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tareas_recordatorio_con_horario') THEN
    ALTER TABLE tareas_personales ADD CONSTRAINT tareas_recordatorio_con_horario
      CHECK (recordatorio IS NULL OR recordatorio IN ('a_la_hora', '1_dia') OR hora_inicio IS NOT NULL);
  END IF;
  -- Con recordatorio, siempre su momento y su estado; sin él, ninguno.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tareas_recordatorio_completo') THEN
    ALTER TABLE tareas_personales ADD CONSTRAINT tareas_recordatorio_completo
      CHECK ((recordatorio IS NULL) = (recordatorio_en IS NULL) AND (recordatorio IS NULL) = (recordatorio_estado IS NULL));
  END IF;
END $$;

-- El aviso de cada minuto solo mira los pendientes.
CREATE INDEX IF NOT EXISTS idx_tareas_recordatorio_pendiente
  ON tareas_personales (recordatorio_en) WHERE recordatorio_estado = 'pendiente';

-- 2. Suscripciones push de cada dispositivo.
CREATE TABLE IF NOT EXISTS suscripciones_push (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint      TEXT         NOT NULL,
  p256dh        TEXT         NOT NULL,
  auth          TEXT         NOT NULL,
  dispositivo   TEXT         NOT NULL DEFAULT '',
  creada_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ultimo_error  TEXT         NULL,
  CONSTRAINT suscripciones_endpoint_unico UNIQUE (endpoint),
  CONSTRAINT suscripciones_endpoint_https CHECK (endpoint LIKE 'https://%'),
  CONSTRAINT suscripciones_dispositivo_corto CHECK (char_length(dispositivo) <= 120)
);
CREATE INDEX IF NOT EXISTS idx_suscripciones_usuario ON suscripciones_push (usuario_id);
ALTER TABLE suscripciones_push ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suscripciones_push FROM anon, authenticated;

-- 3. Preferencias nuevas (M7). El resumen diario lo usa E11d.
ALTER TABLE preferencias_usuario ADD COLUMN IF NOT EXISTS hora_recordatorio TIME NOT NULL DEFAULT '08:00';
ALTER TABLE preferencias_usuario ADD COLUMN IF NOT EXISTS resumen_diario BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE preferencias_usuario ADD COLUMN IF NOT EXISTS hora_resumen TIME NOT NULL DEFAULT '07:00';

-- 4. Registro de envíos. Un resumen por usuario y día (E11d).
CREATE TABLE IF NOT EXISTS envios (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tarea_id    UUID         NULL REFERENCES tareas_personales (id) ON DELETE SET NULL,
  tipo        TEXT         NOT NULL,
  fecha       DATE         NOT NULL,
  resultado   TEXT         NOT NULL,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT envios_tipo_valido CHECK (tipo IN ('recordatorio', 'resumen', 'prueba')),
  CONSTRAINT envios_resultado_corto CHECK (char_length(resultado) <= 200)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_envios_un_resumen_por_dia ON envios (usuario_id, tipo, fecha) WHERE tipo = 'resumen';
CREATE INDEX IF NOT EXISTS idx_envios_usuario ON envios (usuario_id, creado_en DESC);
ALTER TABLE envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON envios FROM anon, authenticated;

-- 5. Aviso de cada minuto (6.12): pg_cron llama con pg_net a POST /api/nova/recordatorios/tick.
-- La dirección, el secreto y la omisión de la protección de Vercel viven en Supabase Vault (nunca en el
-- repositorio): los guarda scripts/configurar-tick.mjs. Sin ellos, la función no llama a nada.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.nova_llamar_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- Sin SET en la definición (Supabase lo rechaza): todos los nombres van con su esquema.
AS $$
DECLARE
  v_url TEXT;
  v_secreto TEXT;
  v_omision TEXT;
  v_encabezados JSONB;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'nova_tick_url';
  SELECT decrypted_secret INTO v_secreto FROM vault.decrypted_secrets WHERE name = 'nova_tick_secreto';
  SELECT decrypted_secret INTO v_omision FROM vault.decrypted_secrets WHERE name = 'nova_tick_omision_vercel';
  IF v_url IS NULL OR v_secreto IS NULL THEN
    RETURN;
  END IF;
  v_encabezados := jsonb_build_object('Content-Type', 'application/json', 'x-nova-tick', v_secreto);
  IF v_omision IS NOT NULL THEN
    v_encabezados := v_encabezados || jsonb_build_object('x-vercel-protection-bypass', v_omision);
  END IF;
  PERFORM net.http_post(url := v_url, body := '{}'::jsonb, headers := v_encabezados, timeout_milliseconds := 55000);
END;
$$;
REVOKE ALL ON FUNCTION public.nova_llamar_tick() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nova-recordatorios') THEN
    PERFORM cron.schedule('nova-recordatorios', '* * * * *', 'SELECT public.nova_llamar_tick()');
  END IF;
END $$;
