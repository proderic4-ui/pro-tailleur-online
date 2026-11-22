CREATE OR REPLACE FUNCTION public.enforce_workshop_quota() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE paid boolean; current_count bigint; maximum integer;
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF NEW.workshop_id <> OLD.workshop_id THEN RAISE EXCEPTION 'Le changement d atelier est interdit'; END IF;
  RETURN NEW;
 END IF;
 PERFORM 1 FROM public.workshops WHERE id = NEW.workshop_id FOR UPDATE;
 SELECT (plan IN ('monthly','annual') AND status = 'active' AND starts_at <= now() AND ends_at IS NOT NULL AND ends_at > now()) INTO paid FROM public.subscriptions WHERE workshop_id = NEW.workshop_id;
 IF coalesce(paid, false) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME = 'clients' THEN
  maximum := 10;
  SELECT count(*) INTO current_count FROM public.clients WHERE workshop_id = NEW.workshop_id;
 ELSE
  maximum := 5;
  SELECT count(*) INTO current_count FROM public.orders WHERE workshop_id = NEW.workshop_id;
 END IF;
 IF current_count >= maximum THEN RAISE EXCEPTION 'Limite de la formule gratuite atteinte (% maximum)', maximum; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_workshop_quota() FROM PUBLIC, anon, authenticated;
