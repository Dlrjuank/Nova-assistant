-- M29 (E21, ahorro de CPU en Vercel): el aviso de cada minuto llama a la app solo si hay algo que hacer. Antes
-- eran 1.440 llamadas al día aunque no hubiera nada.
-- Las condiciones son las mismas de las cinco tareas de POST /api/nova/recordatorios/tick (procesarRecordatorios,
-- procesarResumenes, avanzarLibroEnSegundoPlano, vencerContrasenasTemporales y vencerPreguntasOcr). SI CAMBIA UNA
-- EN EL CÓDIGO, CAMBIA AQUÍ: si no, esa tarea espera a que haya otro trabajo.
-- PENDIENTE de la aprobación del usuario (supabase/pendientes/README.md). Reverso: supabase/reversos/M29_reverso.sql.

CREATE OR REPLACE FUNCTION public.nova_hay_trabajo_tick()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    -- Recordatorios que ya llegaron, y los de tareas completadas desde el código anterior (se marcan omitidos).
    EXISTS (
      SELECT 1 FROM public.tareas_personales t
      WHERE t.recordatorio_estado = 'pendiente' AND (t.recordatorio_en <= now() OR t.estado = 'Completada')
    )
    -- Resumen diario: activo, su hora ya llegó (Bogotá) y aún no está el de hoy.
    OR EXISTS (
      SELECT 1 FROM public.preferencias_usuario p
      WHERE p.resumen_diario AND p.hora_resumen <= (now() AT TIME ZONE 'America/Bogota')::time
        AND NOT EXISTS (
          SELECT 1 FROM public.envios e
          WHERE e.usuario_id = p.usuario_id AND e.tipo = 'resumen' AND e.fecha = (now() AT TIME ZONE 'America/Bogota')::date
        )
    )
    -- Contraseñas temporales que vencieron sin usarse.
    OR EXISTS (
      SELECT 1 FROM public.cuentas c
      WHERE c.debe_cambiar_contrasena AND c.temporal_usada_en IS NULL AND c.temporal_vence_en <= now()
    )
    -- OCR: una pregunta sin respuesta que venció, o una lectura sin avanzar en 7 días (DIAS_LECTURA_SIN_AVANCE).
    OR EXISTS (
      SELECT 1 FROM public.documentos d
      WHERE jsonb_typeof(d.por_indexar) = 'object'
        AND (
          (d.por_indexar->>'estado' = 'pregunta' AND (d.por_indexar->>'venceEn')::timestamptz < now())
          OR (d.por_indexar->>'estado' = 'leyendo' AND (d.indexando_hasta IS NULL OR d.indexando_hasta < now())
              AND coalesce((d.por_indexar->>'avanzoEn')::timestamptz, d.created_at) < now() - make_interval(days => 7))
        )
    )
    -- Un libro a medias que se puede avanzar: libre, sin pregunta pendiente, cuenta activa, con espacio y con clave.
    OR EXISTS (
      SELECT 1 FROM public.documentos d
      WHERE d.progreso IS NOT NULL AND (d.indexando_hasta IS NULL OR d.indexando_hasta < now())
        AND NOT coalesce(jsonb_typeof(d.por_indexar) = 'object' AND d.por_indexar->>'estado' = 'pregunta', false)
        AND EXISTS (
          SELECT 1 FROM public.cuentas c
          WHERE c.usuario_id = d.usuario_id AND c.estado = 'activa'
            AND (c.nivel IN ('dueno', 'admin')
                 OR coalesce((SELECT e.bytes FROM public.nova_espacio(d.usuario_id) e), 0)
                    < (SELECT a.tope_espacio_mb FROM public.administracion a WHERE a.id = 1)::bigint * 1048576)
            AND (
              EXISTS (SELECT 1 FROM public.claves_gemini k WHERE k.usuario_id = d.usuario_id AND k.estado IN ('activa', 'sin_cuota'))
              OR (NOT EXISTS (SELECT 1 FROM public.claves_gemini k WHERE k.usuario_id = d.usuario_id)
                  AND (c.nivel = 'dueno' OR c.usa_clave_proyecto))
            )
        )
    );
$$;
REVOKE ALL ON FUNCTION public.nova_hay_trabajo_tick() FROM PUBLIC, anon, authenticated;

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
  -- Si la revisión fallara (por ejemplo, por un cambio de tablas), se llama igual: mejor de más que dejar de avisar.
  BEGIN
    IF NOT public.nova_hay_trabajo_tick() THEN
      RETURN;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'nova_hay_trabajo_tick falló: %', SQLERRM;
  END;
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
