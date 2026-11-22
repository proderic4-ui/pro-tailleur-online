CREATE OR REPLACE FUNCTION public.create_tailor_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  workshop uuid;
  chosen_plan text;
  trial_end timestamptz;
BEGIN
  IF length(trim(coalesce(NEW.raw_user_meta_data->>'full_name',''))) NOT BETWEEN 1 AND 100
  OR length(trim(coalesce(NEW.raw_user_meta_data->>'workshop_name',''))) NOT BETWEEN 1 AND 120
  OR coalesce(NEW.raw_user_meta_data->>'phone','') !~ '^\+228[0-9]{8}$' THEN
    RAISE EXCEPTION 'Informations du tailleur invalides';
  END IF;

  chosen_plan := lower(trim(coalesce(NEW.raw_user_meta_data->>'plan', '')));
  IF chosen_plan IN ('', 'free', 'gratuit', 'gratuite') THEN
    RAISE EXCEPTION 'La formule gratuite n est plus proposee aux nouveaux comptes. Choisissez Simple, Pro ou Gold.';
  END IF;

  INSERT INTO public.profiles(id, full_name, phone)
  VALUES (NEW.id, trim(NEW.raw_user_meta_data->>'full_name'), NEW.raw_user_meta_data->>'phone');

  INSERT INTO public.workshops(owner_id, name)
  VALUES (NEW.id, trim(NEW.raw_user_meta_data->>'workshop_name'))
  RETURNING id INTO workshop;

  IF chosen_plan IN ('simple', 'pro', 'gold') THEN
    trial_end := ((now() AT TIME ZONE 'Africa/Lome') + interval '1 month') AT TIME ZONE 'Africa/Lome';
    INSERT INTO public.subscriptions(workshop_id, plan, status, starts_at, ends_at, payment_confirmed)
    VALUES (workshop, chosen_plan, 'trial', now(), trial_end, false);
  ELSE
    -- Any unrecognized/spoofed metadata value never grants a paid tier.
    INSERT INTO public.subscriptions(workshop_id, plan, status, starts_at, ends_at, payment_confirmed)
    VALUES (workshop, 'free', 'active', now(), NULL, false);
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_tailor_account() FROM PUBLIC, anon, authenticated;
