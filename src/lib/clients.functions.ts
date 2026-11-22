import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientSchema } from "./client-validation";
import {
  clientLimitMessage,
  fetchWorkshopSubscription,
  isClientLimitReached,
  readOnlyMessage,
  resolveSubscriptionAccess,
} from "./plans";

const fields = "id, full_name, phone, address, notes, created_at";
export const listClients = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: workshop, error } = await context.supabase.from("workshops").select("id, name").eq("owner_id", context.userId).single();
  if (error || !workshop) throw new Error("Votre atelier n’a pas pu être chargé.");
  const [clients, subscription] = await Promise.all([
    context.supabase.from("clients").select(fields).eq("workshop_id", workshop.id).order("created_at", { ascending: false }).order("id"),
    fetchWorkshopSubscription(context.supabase, workshop.id),
  ]);
  if (clients.error || subscription.error) throw new Error("Vos clients n’ont pas pu être chargés.");
  const planAccess = resolveSubscriptionAccess(subscription.data);
  return { clients: clients.data ?? [], workshop, limit: planAccess.clientLimit, planAccess };
});
export const getClient = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const result = await context.supabase.from("clients").select(fields).eq("id", data.id).maybeSingle();
  if (result.error) throw new Error("Cette fiche n’a pas pu être chargée.");
  return result.data;
});
export const createClient = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(clientSchema).handler(async ({ data, context }) => {
  const workshop = await context.supabase.from("workshops").select("id").eq("owner_id", context.userId).single();
  if (workshop.error || !workshop.data) throw new Error("Votre atelier n’a pas pu être chargé.");
  const [subscription, clientsCount] = await Promise.all([
    fetchWorkshopSubscription(context.supabase, workshop.data.id),
    context.supabase.from("clients").select("id", { count: "exact", head: true }).eq("workshop_id", workshop.data.id),
  ]);
  if (subscription.error || clientsCount.error) return { client: null, error: "Le client n’a pas pu être enregistré. Réessayez." };
  const planAccess = resolveSubscriptionAccess(subscription.data);
  if (!planAccess.canManage) {
    return { client: null, error: readOnlyMessage(planAccess) };
  }
  if (isClientLimitReached(clientsCount.count ?? 0, planAccess.clientLimit)) {
    return { client: null, error: clientLimitMessage(planAccess) };
  }
  const result = await context.supabase.from("clients").insert({ ...data, workshop_id: workshop.data.id }).select(fields).single();
  if (result.error) {
    const isReadOnlyError = result.error.message.includes("essai gratuit") || result.error.message.includes("abonnement");
    if (isReadOnlyError) return { client: null, error: readOnlyMessage(planAccess) };
    const isQuotaError = result.error.message.includes("maximum") || result.error.message.includes("Limite de");
    return { client: null, error: isQuotaError ? clientLimitMessage(planAccess) : "Le client n’a pas pu être enregistré. Réessayez." };
  }
  return { client: result.data, error: null };
});
export const updateClient = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(clientSchema.extend({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const workshop = await context.supabase.from("workshops").select("id").eq("owner_id", context.userId).single();
  if (workshop.error || !workshop.data) throw new Error("Votre atelier n’a pas pu être chargé.");
  const subscription = await fetchWorkshopSubscription(context.supabase, workshop.data.id);
  if (subscription.error) return { client: null, error: "Ce client est inaccessible ou n’a pas pu être modifié." };
  const planAccess = resolveSubscriptionAccess(subscription.data);
  if (!planAccess.canManage) {
    return { client: null, error: readOnlyMessage(planAccess) };
  }
  const { id, ...values } = data;
  const result = await context.supabase.from("clients").update(values).eq("id", id).eq("workshop_id", workshop.data.id).select(fields).maybeSingle();
  if (result.error) {
    const isReadOnlyError = result.error.message.includes("essai gratuit") || result.error.message.includes("abonnement");
    return { client: null, error: isReadOnlyError ? readOnlyMessage(planAccess) : "Ce client est inaccessible ou n’a pas pu être modifié." };
  }
  if (!result.data) return { client: null, error: "Ce client est inaccessible ou n’a pas pu être modifié." };
  return { client: result.data, error: null };
});