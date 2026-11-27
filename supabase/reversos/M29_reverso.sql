-- Reverso de M29: el aviso de cada minuto vuelve a llamar siempre (la función de M16) y se quita la revisión.

CREATE OR REPLACE FUNCTION public.nova_llamar_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP FUNCTION IF EXISTS public.nova_hay_trabajo_tick();

DELETE FROM _migrations WHERE nombre = '20261128120000_nova_tick_solo_con_trabajo.sql';
