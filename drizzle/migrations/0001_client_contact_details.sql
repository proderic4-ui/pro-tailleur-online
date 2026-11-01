ALTER TABLE public.clients ADD COLUMN phone text, ADD COLUMN address text NOT NULL DEFAULT '', ADD COLUMN notes text NOT NULL DEFAULT '';
ALTER TABLE public.clients ADD CONSTRAINT clients_phone_format CHECK (phone IS NULL OR (phone ~ '^\+?[0-9 ()-]+$' AND length(regexp_replace(phone, '[^0-9]', '', 'g')) BETWEEN 8 AND 15 AND length(phone) <= 30)), ADD CONSTRAINT clients_address_length CHECK (length(address) <= 300), ADD CONSTRAINT clients_notes_length CHECK (length(notes) <= 2000);
CREATE FUNCTION public.validate_client_contact() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 NEW.full_name := trim(NEW.full_name);
 NEW.phone := trim(NEW.phone);
 NEW.address := trim(NEW.address);
 NEW.notes := trim(NEW.notes);
 IF NEW.phone IS NULL OR NEW.phone = '' THEN RAISE EXCEPTION 'Le numéro de téléphone est obligatoire'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_client_contact() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_client_contact BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.validate_client_contact();