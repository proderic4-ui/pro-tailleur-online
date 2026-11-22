CREATE OR REPLACE FUNCTION public.workshop_can_manage(wid uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  sub_plan text;
  sub_status text;
  sub_starts_at timestamptz;
  sub_ends_at timestamptz;
  sub_paid boolean;
BEGIN
  SELECT plan, status, starts_at, ends_at, payment_confirmed
  INTO sub_plan, sub_status, sub_starts_at, sub_ends_at, sub_paid
  FROM public.subscriptions
  WHERE workshop_id = wid;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Active 1-month free trial (max 100 clients and 100 orders)
  IF sub_plan IN ('simple', 'pro', 'gold')
     AND sub_status = 'trial'
     AND coalesce(sub_paid, false) = false
     AND sub_starts_at <= now()
     AND sub_ends_at IS NOT NULL
     AND sub_ends_at > now() THEN
    RETURN true;
  END IF;

  -- Confirmed paid subscription (Simple, Pro, Gold)
  IF sub_plan IN ('simple', 'pro', 'gold')
     AND sub_status = 'active'
     AND coalesce(sub_paid, false) = true
     AND sub_starts_at <= now()
     AND sub_ends_at IS NOT NULL
     AND sub_ends_at > now() THEN
    RETURN true;
  END IF;

  -- Legacy active monthly/annual plans
  IF sub_plan IN ('monthly', 'annual')
     AND sub_status = 'active'
     AND sub_starts_at <= now()
     AND sub_ends_at IS NOT NULL
     AND sub_ends_at > now() THEN
    RETURN true;
  END IF;

  -- Preserve existing legacy free accounts without deleting data or revoking existing access
  IF sub_plan = 'free' AND sub_status = 'active' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.workshop_can_manage(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_workshop_quota() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  sub_plan text;
  sub_status text;
  sub_starts_at timestamptz;
  sub_ends_at timestamptz;
  sub_paid boolean;
  is_active_trial boolean;
  is_confirmed_paid boolean;
  is_legacy_free boolean;
  current_count bigint;
  maximum integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.workshop_id <> OLD.workshop_id THEN
    RAISE EXCEPTION 'Le changement d atelier est interdit';
  END IF;

  PERFORM 1 FROM public.workshops WHERE id = NEW.workshop_id FOR UPDATE;

  SELECT plan, status, starts_at, ends_at, payment_confirmed
  INTO sub_plan, sub_status, sub_starts_at, sub_ends_at, sub_paid
  FROM public.subscriptions
  WHERE workshop_id = NEW.workshop_id;

  is_active_trial :=
    sub_plan IN ('simple', 'pro', 'gold')
    AND sub_status = 'trial'
    AND coalesce(sub_paid, false) = false
    AND sub_starts_at <= now()
    AND sub_ends_at IS NOT NULL
    AND sub_ends_at > now();

  is_confirmed_paid :=
    (
      sub_plan IN ('simple', 'pro', 'gold')
      AND sub_status = 'active'
      AND coalesce(sub_paid, false) = true
      AND sub_starts_at <= now()
      AND sub_ends_at IS NOT NULL
      AND sub_ends_at > now()
    )
    OR (
      sub_plan IN ('monthly', 'annual')
      AND sub_status = 'active'
      AND sub_starts_at <= now()
      AND sub_ends_at IS NOT NULL
      AND sub_ends_at > now()
    );

  is_legacy_free := sub_plan = 'free' AND sub_status = 'active';

  IF NOT (coalesce(is_active_trial, false) OR coalesce(is_confirmed_paid, false) OR coalesce(is_legacy_free, false)) THEN
    RAISE EXCEPTION 'Votre essai gratuit de 1 mois est termine. Activez un abonnement Simple, Pro ou Gold pour modifier vos donnees.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF coalesce(is_active_trial, false) THEN
    maximum := 100;
    IF TG_TABLE_NAME = 'clients' THEN
      SELECT count(*) INTO current_count FROM public.clients WHERE workshop_id = NEW.workshop_id;
    ELSE
      SELECT count(*) INTO current_count FROM public.orders WHERE workshop_id = NEW.workshop_id;
    END IF;
    IF current_count >= maximum THEN
      RAISE EXCEPTION 'Limite de l essai gratuit atteinte (% maximum)', maximum;
    END IF;
    RETURN NEW;
  END IF;

  IF coalesce(is_confirmed_paid, false) THEN
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

  -- Legacy free accounts
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

CREATE OR REPLACE FUNCTION public.require_active_workshop_management() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.workshop_can_manage(NEW.workshop_id) THEN
    RAISE EXCEPTION 'Votre essai gratuit de 1 mois est termine. Activez un abonnement Simple, Pro ou Gold pour modifier vos donnees.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_active_workshop_management() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_garment_categories_management ON public.garment_categories;
CREATE TRIGGER enforce_garment_categories_management
  BEFORE INSERT OR UPDATE ON public.garment_categories
  FOR EACH ROW EXECUTE FUNCTION public.require_active_workshop_management();

DROP TRIGGER IF EXISTS enforce_client_measurements_management ON public.client_measurements;
CREATE TRIGGER enforce_client_measurements_management
  BEFORE INSERT OR UPDATE ON public.client_measurements
  FOR EACH ROW EXECUTE FUNCTION public.require_active_workshop_management();

-- Restrictive RLS write policies block authenticated mutations (including DELETE) when trial is expired,
-- while keeping SELECT open in read-only mode and leaving service_role / cascade deletes unaffected.
DROP POLICY IF EXISTS clients_require_active_plan_insert ON public.clients;
DROP POLICY IF EXISTS clients_require_active_plan_update ON public.clients;
DROP POLICY IF EXISTS clients_require_active_plan_delete ON public.clients;
CREATE POLICY clients_require_active_plan_insert ON public.clients AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ));
CREATE POLICY clients_require_active_plan_update ON public.clients AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ));
CREATE POLICY clients_require_active_plan_delete ON public.clients AS RESTRICTIVE FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ));

DROP POLICY IF EXISTS orders_require_active_plan_insert ON public.orders;
DROP POLICY IF EXISTS orders_require_active_plan_update ON public.orders;
DROP POLICY IF EXISTS orders_require_active_plan_delete ON public.orders;
CREATE POLICY orders_require_active_plan_insert ON public.orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ));
CREATE POLICY orders_require_active_plan_update ON public.orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ));
CREATE POLICY orders_require_active_plan_delete ON public.orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ));

DROP POLICY IF EXISTS garment_categories_require_active_plan_insert ON public.garment_categories;
DROP POLICY IF EXISTS garment_categories_require_active_plan_update ON public.garment_categories;
DROP POLICY IF EXISTS garment_categories_require_active_plan_delete ON public.garment_categories;
CREATE POLICY garment_categories_require_active_plan_insert ON public.garment_categories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ));
CREATE POLICY garment_categories_require_active_plan_update ON public.garment_categories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ));
CREATE POLICY garment_categories_require_active_plan_delete ON public.garment_categories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ));

DROP POLICY IF EXISTS client_measurements_require_active_plan_insert ON public.client_measurements;
CREATE POLICY client_measurements_require_active_plan_insert ON public.client_measurements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.workshop_id = workshop_id AND (
      (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
      OR (s.plan = 'free' AND s.status = 'active')
    )
  ));

DROP POLICY IF EXISTS order_photos_insert ON storage.objects;
DROP POLICY IF EXISTS order_photos_delete ON storage.objects;
CREATE POLICY order_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'order-photos'
    AND EXISTS (
      SELECT 1
      FROM public.workshops w
      JOIN public.subscriptions s ON s.workshop_id = w.id
      WHERE w.id::text = (storage.foldername(objects.name))[1]
        AND w.owner_id = auth.uid()
        AND (
          (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
          OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
          OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
          OR (s.plan = 'free' AND s.status = 'active')
        )
    )
  );
CREATE POLICY order_photos_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'order-photos'
    AND EXISTS (
      SELECT 1
      FROM public.workshops w
      JOIN public.subscriptions s ON s.workshop_id = w.id
      WHERE w.id::text = (storage.foldername(objects.name))[1]
        AND w.owner_id = auth.uid()
        AND (
          (s.plan IN ('simple','pro','gold') AND s.status = 'trial' AND coalesce(s.payment_confirmed, false) = false AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
          OR (s.plan IN ('simple','pro','gold') AND s.status = 'active' AND coalesce(s.payment_confirmed, false) = true AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
          OR (s.plan IN ('monthly','annual') AND s.status = 'active' AND s.starts_at <= now() AND s.ends_at IS NOT NULL AND s.ends_at > now())
          OR (s.plan = 'free' AND s.status = 'active')
        )
    )
  );
