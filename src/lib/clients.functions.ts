import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientSchema, FREE_CLIENT_MESSAGE } from "./client-validation";

const fields = "id, full_name, phone, address, notes, created_at";
export const listClients = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: workshop, error } = await context.supabase.from("workshops").select("id, name").eq("owner_id", context.userId).single();
  if (error || !workshop) throw new Error("Votre atelier n’a pas pu être chargé.");
  const [clients, subscription] = await Promise.all([
    context.supabase.from("clients").select(fields).eq("workshop_id", workshop.id).order("created_at", { ascending: false }).order("id"),
    context.supabase.from("subscriptions").select("plan, status, starts_at, ends_at").eq("workshop_id", workshop.id).single(),
  ]);
  if (clients.error || subscription.error) throw new Error("Vos clients n’ont pas pu être chargés.");
  const plan = subscription.data;
  const now = Date.now();
  const paid = plan && ["monthly", "annual"].includes(plan.plan) && plan.status === "active" && Date.parse(plan.starts_at) <= now && plan.ends_at && Date.parse(plan.ends_at) > now;
  return { clients: clients.data ?? [], workshop, limit: paid ? null : 10 };
});
export const getClient = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const result = await context.supabase.from("clients").select(fields).eq("id", data.id).maybeSingle();
  if (result.error) throw new Error("Cette fiche n’a pas pu être chargée.");
  return result.data;
});
export const createClient = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(clientSchema).handler(async ({ data, context }) => {
  const workshop = await context.supabase.from("workshops").select("id").eq("owner_id", context.userId).single();
  if (workshop.error || !workshop.data) throw new Error("Votre atelier n’a pas pu être chargé.");
  const result = await context.supabase.from("clients").insert({ ...data, workshop_id: workshop.data.id }).select(fields).single();
  if (result.error) return { client: null, error: result.error.message.includes("10 maximum") ? FREE_CLIENT_MESSAGE : "Le client n’a pas pu être enregistré. Réessayez." };
  return { client: result.data, error: null };
});
export const updateClient = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(clientSchema.extend({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const { id, ...values } = data;
  const result = await context.supabase.from("clients").update(values).eq("id", id).select(fields).maybeSingle();
  if (result.error || !result.data) return { client: null, error: "Ce client est inaccessible ou n’a pas pu être modifié." };
  return { client: result.data, error: null };
});