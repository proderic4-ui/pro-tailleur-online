ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'simple', 'pro', 'gold', 'monthly', 'annual'));

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'trial', 'expired', 'cancelled'));

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

  INSERT INTO public.profiles(id, full_name, phone)
  VALUES (NEW.id, trim(NEW.raw_user_meta_data->>'full_name'), NEW.raw_user_meta_data->>'phone');

  INSERT INTO public.workshops(owner_id, name)
  VALUES (NEW.id, trim(NEW.raw_user_meta_data->>'workshop_name'))
  RETURNING id INTO workshop;

  chosen_plan := lower(trim(coalesce(NEW.raw_user_meta_data->>'plan', '')));
  IF chosen_plan IN ('simple', 'pro', 'gold') THEN
    trial_end := ((now() AT TIME ZONE 'Africa/Lome') + interval '1 month') AT TIME ZONE 'Africa/Lome';
    INSERT INTO public.subscriptions(workshop_id, plan, status, starts_at, ends_at, payment_confirmed)
    VALUES (workshop, chosen_plan, 'trial', now(), trial_end, false);
  ELSE
    INSERT INTO public.subscriptions(workshop_id, plan, status, starts_at, ends_at, payment_confirmed)
    VALUES (workshop, 'free', 'active', now(), NULL, false);
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_tailor_account() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_workshop_quota() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  sub_plan text;
  sub_status text;
  sub_starts_at timestamptz;
  sub_ends_at timestamptz;
  sub_paid boolean;
  has_entitlement boolean;
  current_count bigint;
  maximum integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workshop_id <> OLD.workshop_id THEN
      RAISE EXCEPTION 'Le changement d atelier est interdit';
    END IF;
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.workshops WHERE id = NEW.workshop_id FOR UPDATE;

  SELECT plan, status, starts_at, ends_at, payment_confirmed
  INTO sub_plan, sub_status, sub_starts_at, sub_ends_at, sub_paid
  FROM public.subscriptions
  WHERE workshop_id = NEW.workshop_id;

  has_entitlement :=
    (
      sub_plan IN ('simple', 'pro', 'gold')
      AND sub_starts_at <= now()
      AND sub_ends_at IS NOT NULL
      AND sub_ends_at > now()
      AND (
        (sub_status = 'active' AND coalesce(sub_paid, false) = true)
        OR sub_status = 'trial'
      )
    )
    OR (
      sub_plan IN ('monthly', 'annual')
      AND sub_status = 'active'
      AND sub_starts_at <= now()
      AND sub_ends_at IS NOT NULL
      AND sub_ends_at > now()
    );

  IF coalesce(has_entitlement, false) THEN
    IF TG_TABLE_NAME = 'orders' THEN
      RETURN NEW;
    END IF;

    IF sub_plan = 'simple' THEN
      maximum := 100;
    ELSIF sub_plan = 'pro' THEN
      maximum := 200;
    ELSIF sub_plan = 'gold' THEN
      maximum := 500;
    ELSE
      RETURN NEW;
    END IF;

    SELECT count(*) INTO current_count FROM public.clients WHERE workshop_id = NEW.workshop_id;
    IF current_count >= maximum THEN
      RAISE EXCEPTION 'Limite de clients de la formule atteinte (% maximum)', maximum;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'clients' THEN
    maximum := 10;
    SELECT count(*) INTO current_count FROM public.clients WHERE workshop_id = NEW.workshop_id;
  ELSE
    maximum := 5;
    SELECT count(*) INTO current_count FROM public.orders WHERE workshop_id = NEW.workshop_id;
  END IF;

  IF current_count >= maximum THEN
    RAISE EXCEPTION 'Limite de la formule gratuite atteinte (% maximum)', maximum;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_workshop_quota() FROM PUBLIC, anon, authenticated;
