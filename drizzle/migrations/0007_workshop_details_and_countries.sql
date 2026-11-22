ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

ALTER TABLE public.workshops DROP CONSTRAINT IF EXISTS workshops_address_length;
ALTER TABLE public.workshops DROP CONSTRAINT IF EXISTS workshops_city_length;
ALTER TABLE public.workshops DROP CONSTRAINT IF EXISTS workshops_country_length;
ALTER TABLE public.workshops DROP CONSTRAINT IF EXISTS workshops_phone_format;
ALTER TABLE public.workshops DROP CONSTRAINT IF EXISTS workshops_email_length;
ALTER TABLE public.workshops DROP CONSTRAINT IF EXISTS workshops_description_length;

ALTER TABLE public.workshops
  ADD CONSTRAINT workshops_address_length CHECK (length(address) <= 300),
  ADD CONSTRAINT workshops_city_length CHECK (length(city) <= 100),
  ADD CONSTRAINT workshops_country_length CHECK (length(country) <= 100),
  ADD CONSTRAINT workshops_phone_format CHECK (
    phone = ''
    OR (
      phone ~ '^\+?[0-9 ()-]+$'
      AND length(regexp_replace(phone, '[^0-9]', '', 'g')) BETWEEN 8 AND 15
      AND length(phone) <= 30
    )
  ),
  ADD CONSTRAINT workshops_email_length CHECK (length(email) <= 255),
  ADD CONSTRAINT workshops_description_length CHECK (length(description) <= 2000);

GRANT UPDATE(name, address, city, country, phone, email, description) ON public.workshops TO authenticated;

CREATE OR REPLACE FUNCTION public.create_tailor_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  workshop uuid;
  chosen_plan text;
  trial_end timestamptz;
  w_address text;
  w_city text;
  w_country text;
  w_phone text;
  w_email text;
  w_description text;
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

  w_address := trim(coalesce(NEW.raw_user_meta_data->>'workshop_address', ''));
  w_city := trim(coalesce(NEW.raw_user_meta_data->>'workshop_city', ''));
  w_country := trim(coalesce(NEW.raw_user_meta_data->>'workshop_country', ''));
  w_phone := trim(coalesce(NEW.raw_user_meta_data->>'workshop_phone', ''));
  w_email := trim(coalesce(NEW.raw_user_meta_data->>'workshop_email', ''));
  w_description := trim(coalesce(NEW.raw_user_meta_data->>'workshop_description', ''));

  IF length(w_address) > 300
  OR length(w_city) > 100
  OR length(w_country) > 100
  OR length(w_email) > 255
  OR length(w_description) > 2000 THEN
    RAISE EXCEPTION 'Informations de l atelier invalides';
  END IF;

  IF lower(w_country) = 'autre' THEN
    RAISE EXCEPTION 'Indiquez le nom du pays';
  END IF;

  IF w_phone <> '' AND (
    w_phone !~ '^\+?[0-9 ()-]+$'
    OR length(regexp_replace(w_phone, '[^0-9]', '', 'g')) NOT BETWEEN 8 AND 15
    OR length(w_phone) > 30
  ) THEN
    RAISE EXCEPTION 'Numero de telephone de l atelier invalide';
  END IF;

  IF w_email <> '' AND w_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Adresse e-mail de l atelier invalide';
  END IF;

  INSERT INTO public.profiles(id, full_name, phone)
  VALUES (NEW.id, trim(NEW.raw_user_meta_data->>'full_name'), NEW.raw_user_meta_data->>'phone');

  INSERT INTO public.workshops(owner_id, name, address, city, country, phone, email, description)
  VALUES (
    NEW.id,
    trim(NEW.raw_user_meta_data->>'workshop_name'),
    w_address,
    w_city,
    w_country,
    w_phone,
    w_email,
    w_description
  )
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
