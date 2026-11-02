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
  maximum := 3;
  SELECT count(*) INTO current_count FROM public.orders WHERE workshop_id = NEW.workshop_id;
 END IF;
 IF current_count >= maximum THEN RAISE EXCEPTION 'Limite de la formule gratuite atteinte (% maximum)', maximum; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_workshop_quota() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.garment_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
 measurement_labels text[] NOT NULL DEFAULT '{}' CHECK (cardinality(measurement_labels) <= 30),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (workshop_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garment_categories TO authenticated;
GRANT ALL ON public.garment_categories TO service_role;
ALTER TABLE public.garment_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY garment_categories_own ON public.garment_categories FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.owner_id = auth.uid()));

CREATE TABLE public.client_measurements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
 client_id uuid NOT NULL,
 garment_type text NOT NULL CHECK (length(garment_type) BETWEEN 1 AND 60),
 measurements jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(measurements) = 'array'),
 taken_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (client_id, workshop_id) REFERENCES public.clients(id, workshop_id) ON DELETE CASCADE
);
GRANT SELECT, INSERT ON public.client_measurements TO authenticated;
GRANT ALL ON public.client_measurements TO service_role;
ALTER TABLE public.client_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_measurements_read ON public.client_measurements FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.owner_id = auth.uid()));
CREATE POLICY client_measurements_insert ON public.client_measurements FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.owner_id = auth.uid()));
CREATE INDEX client_measurements_client_idx ON public.client_measurements(client_id, taken_at DESC);

ALTER TABLE public.orders
 ADD COLUMN order_number integer,
 ADD COLUMN garment_type text NOT NULL DEFAULT 'Autre',
 ADD COLUMN description text NOT NULL DEFAULT '',
 ADD COLUMN colors text NOT NULL DEFAULT '',
 ADD COLUMN finishes text NOT NULL DEFAULT '',
 ADD COLUMN measurements jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN delivery_date date,
 ADD COLUMN total_price integer NOT NULL DEFAULT 0,
 ADD COLUMN deposit integer NOT NULL DEFAULT 0,
 ADD COLUMN balance integer GENERATED ALWAYS AS (total_price - deposit) STORED,
 ADD COLUMN notes text NOT NULL DEFAULT '',
 ADD COLUMN status text NOT NULL DEFAULT 'new',
 ADD COLUMN model_photo_path text,
 ADD COLUMN fabric_photo_path text,
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.orders
 ADD CONSTRAINT orders_status_check CHECK (status IN ('new','waiting','in_progress','finishing','ready','delivered','cancelled')),
 ADD CONSTRAINT orders_amounts_check CHECK (total_price >= 0 AND deposit >= 0 AND deposit <= total_price AND total_price <= 100000000),
 ADD CONSTRAINT orders_client_required CHECK (client_id IS NOT NULL) NOT VALID,
 ADD CONSTRAINT orders_text_lengths CHECK (length(description) <= 2000 AND length(colors) <= 300 AND length(finishes) <= 1000 AND length(notes) <= 2000 AND length(garment_type) BETWEEN 1 AND 60),
 ADD CONSTRAINT orders_measurements_array CHECK (jsonb_typeof(measurements) = 'array'),
 ADD CONSTRAINT orders_photo_paths CHECK ((model_photo_path IS NULL OR model_photo_path LIKE workshop_id::text || '/%') AND (fabric_photo_path IS NULL OR fabric_photo_path LIKE workshop_id::text || '/%'));
CREATE UNIQUE INDEX orders_workshop_number_idx ON public.orders(workshop_id, order_number);

CREATE FUNCTION public.assign_order_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'UPDATE' THEN
  NEW.order_number := OLD.order_number;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
 END IF;
 PERFORM 1 FROM public.workshops WHERE id = NEW.workshop_id FOR UPDATE;
 SELECT coalesce(max(order_number), 0) + 1 INTO NEW.order_number FROM public.orders WHERE workshop_id = NEW.workshop_id;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_order_number() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assign_order_number BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

CREATE POLICY order_photos_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'order-photos' AND EXISTS (SELECT 1 FROM public.workshops w WHERE w.id::text = (storage.foldername(name))[1] AND w.owner_id = auth.uid()));
CREATE POLICY order_photos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'order-photos' AND EXISTS (SELECT 1 FROM public.workshops w WHERE w.id::text = (storage.foldername(name))[1] AND w.owner_id = auth.uid()));
CREATE POLICY order_photos_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'order-photos' AND EXISTS (SELECT 1 FROM public.workshops w WHERE w.id::text = (storage.foldername(name))[1] AND w.owner_id = auth.uid()));