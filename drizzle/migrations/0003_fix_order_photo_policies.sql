DROP POLICY order_photos_select ON storage.objects;
DROP POLICY order_photos_insert ON storage.objects;
DROP POLICY order_photos_delete ON storage.objects;
CREATE POLICY order_photos_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'order-photos' AND EXISTS (SELECT 1 FROM public.workshops w WHERE w.id::text = (storage.foldername(objects.name))[1] AND w.owner_id = auth.uid()));
CREATE POLICY order_photos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'order-photos' AND EXISTS (SELECT 1 FROM public.workshops w WHERE w.id::text = (storage.foldername(objects.name))[1] AND w.owner_id = auth.uid()));
CREATE POLICY order_photos_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'order-photos' AND EXISTS (SELECT 1 FROM public.workshops w WHERE w.id::text = (storage.foldername(objects.name))[1] AND w.owner_id = auth.uid()));