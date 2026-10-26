CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 100),
 phone text NOT NULL CHECK (phone ~ '^\+228[0-9]{8}$'),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(full_name, phone) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_read_own ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.workshops (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workshops TO authenticated;
GRANT UPDATE(name) ON public.workshops TO authenticated;
GRANT ALL ON public.workshops TO service_role;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
CREATE POLICY workshops_read_own ON public.workshops FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY workshops_update_own ON public.workshops FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.subscriptions (
 workshop_id uuid PRIMARY KEY REFERENCES public.workshops(id) ON DELETE CASCADE,
 plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','monthly','annual')),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
 starts_at timestamptz NOT NULL DEFAULT now(),
 ends_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_read_own ON public.subscriptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.owner_id = auth.uid()));

CREATE TABLE public.clients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
 full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 100),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (id, workshop_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_own ON public.clients FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.owner_id = auth.uid()));

CREATE TABLE public.orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
 client_id uuid,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (client_id, workshop_id) REFERENCES public.clients(id, workshop_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_own ON public.orders FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.owner_id = auth.uid()));
CREATE INDEX clients_workshop_idx ON public.clients(workshop_id);
CREATE INDEX orders_workshop_idx ON public.orders(workshop_id);

CREATE FUNCTION public.create_tailor_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE workshop uuid;
BEGIN
 IF length(trim(coalesce(NEW.raw_user_meta_data->>'full_name',''))) NOT BETWEEN 1 AND 100
 OR length(trim(coalesce(NEW.raw_user_meta_data->>'workshop_name',''))) NOT BETWEEN 1 AND 120
 OR coalesce(NEW.raw_user_meta_data->>'phone','') !~ '^\+228[0-9]{8}$' THEN
 RAISE EXCEPTION 'Informations du tailleur invalides';
 END IF;
 INSERT INTO public.profiles(id, full_name, phone) VALUES (NEW.id, trim(NEW.raw_user_meta_data->>'full_name'), NEW.raw_user_meta_data->>'phone');
 INSERT INTO public.workshops(owner_id, name) VALUES (NEW.id, trim(NEW.raw_user_meta_data->>'workshop_name')) RETURNING id INTO workshop;
 INSERT INTO public.subscriptions(workshop_id) VALUES (workshop);
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_tailor_account() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER create_tailor_account AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_tailor_account();

CREATE FUNCTION public.enforce_workshop_quota() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
  maximum := 5;
  SELECT count(*) INTO current_count FROM public.clients WHERE workshop_id = NEW.workshop_id;
 ELSE
  maximum := 3;
  SELECT count(*) INTO current_count FROM public.orders WHERE workshop_id = NEW.workshop_id;
 END IF;
 IF current_count >= maximum THEN RAISE EXCEPTION 'Limite de la formule gratuite atteinte (% maximum)', maximum; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_workshop_quota() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_client_quota BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.enforce_workshop_quota();
CREATE TRIGGER enforce_order_quota BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.enforce_workshop_quota();