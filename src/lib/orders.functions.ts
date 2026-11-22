import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isFreeOrderLimitReached, orderSchema, orderUpdateSchema, statusValues } from "./garments";
import { fetchWorkshopSubscription, orderLimitMessage, readOnlyMessage, resolveSubscriptionAccess } from "./plans";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };
async function myWorkshop(context: Ctx) {
  const { data, error } = await context.supabase.from("workshops").select("id, name").eq("owner_id", context.userId).single();
  if (error || !data) throw new Error("Votre atelier n’a pas pu être chargé.");
  return data as { id: string; name: string };
}
const listFields = "id, order_number, garment_type, delivery_date, total_price, deposit, balance, status, created_at, client:clients(id, full_name)";

export const listOrders = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const workshop = await myWorkshop(context);
  const [orders, subscription] = await Promise.all([
    context.supabase.from("orders").select(listFields).eq("workshop_id", workshop.id).order("order_number", { ascending: false }),
    fetchWorkshopSubscription(context.supabase, workshop.id),
  ]);
  if (orders.error || subscription.error) throw new Error("Vos commandes n’ont pas pu être chargées.");
  const planAccess = resolveSubscriptionAccess(subscription.data);
  return { workshop, orders: orders.data ?? [], limit: planAccess.orderLimit, planAccess };
});

export const getOrderFormData = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const workshop = await myWorkshop(context);
  const [clients, categories, measurements, subscription, ordersCount] = await Promise.all([
    context.supabase.from("clients").select("id, full_name, phone").eq("workshop_id", workshop.id).order("full_name"),
    context.supabase.from("garment_categories").select("id, name, measurement_labels").eq("workshop_id", workshop.id).order("name"),
    context.supabase.from("client_measurements").select("client_id, garment_type, measurements, taken_at").eq("workshop_id", workshop.id).order("taken_at", { ascending: false }).limit(500),
    fetchWorkshopSubscription(context.supabase, workshop.id),
    context.supabase.from("orders").select("id", { count: "exact", head: true }).eq("workshop_id", workshop.id),
  ]);
  if (clients.error || categories.error || measurements.error || subscription.error || ordersCount.error) throw new Error("Le formulaire n’a pas pu être chargé.");
  const planAccess = resolveSubscriptionAccess(subscription.data);
  return { workshopId: workshop.id, clients: clients.data ?? [], categories: categories.data ?? [], measurements: measurements.data ?? [], orderCount: ordersCount.count ?? 0, limit: planAccess.orderLimit, planAccess };
});

export const addGarmentCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().trim().min(1, "Nom obligatoire.").max(60), measurement_labels: z.array(z.string().trim().min(1).max(60)).max(30) }))
  .handler(async ({ data, context }) => {
    const workshop = await myWorkshop(context);
    const subscription = await fetchWorkshopSubscription(context.supabase, workshop.id);
    if (subscription.error) return { category: null, error: "Le modèle n’a pas pu être enregistré." };
    const planAccess = resolveSubscriptionAccess(subscription.data);
    if (!planAccess.canManage) return { category: null, error: readOnlyMessage(planAccess) };
    const r = await context.supabase.from("garment_categories").insert({ ...data, workshop_id: workshop.id }).select("id, name, measurement_labels").single();
    if (r.error) return { category: null, error: r.error.code === "23505" ? "Ce modèle existe déjà." : "Le modèle n’a pas pu être enregistré." };
    return { category: r.data, error: null };
  });

export const createOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(orderSchema).handler(async ({ data, context }) => {
  const workshop = await myWorkshop(context);
  for (const path of [data.model_photo_path, data.fabric_photo_path]) if (path && !path.startsWith(`${workshop.id}/`)) return { id: null, error: "Photo invalide." };
  const [subscription, ordersCount] = await Promise.all([
    fetchWorkshopSubscription(context.supabase, workshop.id),
    context.supabase.from("orders").select("id", { count: "exact", head: true }).eq("workshop_id", workshop.id),
  ]);
  if (subscription.error || ordersCount.error) return { id: null, error: "La commande n’a pas pu être enregistrée. Réessayez." };
  const planAccess = resolveSubscriptionAccess(subscription.data);
  if (!planAccess.canManage) return { id: null, error: readOnlyMessage(planAccess) };
  if (isFreeOrderLimitReached(ordersCount.count ?? 0, planAccess.orderLimit)) return { id: null, error: orderLimitMessage(planAccess) };
  const result = await context.supabase.from("orders").insert({ ...data, title: data.garment_type, workshop_id: workshop.id, status: "new" }).select("id").single();
  if (result.error) {
    const isReadOnlyError = result.error.message.includes("essai gratuit") || result.error.message.includes("abonnement");
    if (isReadOnlyError) return { id: null, error: readOnlyMessage(planAccess) };
    const isQuotaError = result.error.message.includes("maximum") || result.error.message.includes("Limite de");
    return { id: null, error: isQuotaError ? orderLimitMessage(planAccess) : "La commande n’a pas pu être enregistrée. Vérifiez le client choisi et réessayez." };
  }
  // Dated measurement history; the order keeps its own frozen copy.
  if (data.measurements.length) await context.supabase.from("client_measurements").insert({ workshop_id: workshop.id, client_id: data.client_id, garment_type: data.garment_type, measurements: data.measurements });
  return { id: result.data.id as string, error: null };
});

export const updateOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(orderUpdateSchema).handler(async ({ data, context }) => {
  const workshop = await myWorkshop(context);
  const { id, ...fields } = data;
  for (const path of [fields.model_photo_path, fields.fabric_photo_path]) if (path && !path.startsWith(`${workshop.id}/`)) return { error: "Photo invalide." };
  const [before, subscription] = await Promise.all([
    context.supabase.from("orders").select("client_id, measurements").eq("id", id).eq("workshop_id", workshop.id).maybeSingle(),
    fetchWorkshopSubscription(context.supabase, workshop.id),
  ]);
  if (subscription.error) return { error: "La commande n’a pas pu être modifiée. Réessayez." };
  const planAccess = resolveSubscriptionAccess(subscription.data);
  if (!planAccess.canManage) return { error: readOnlyMessage(planAccess) };
  if (before.error || !before.data) return { error: "Cette commande n’existe pas ou n’appartient pas à votre atelier." };
  // Update only: client, number, creation date and balance are not sent (DB keeps/computes them).
  const r = await context.supabase.from("orders").update({ ...fields, title: fields.garment_type }).eq("id", id).eq("workshop_id", workshop.id).select("id").maybeSingle();
  if (r.error) {
    const isReadOnlyError = r.error.message.includes("essai gratuit") || r.error.message.includes("abonnement");
    return { error: isReadOnlyError ? readOnlyMessage(planAccess) : "La commande n’a pas pu être modifiée. Réessayez." };
  }
  if (!r.data) return { error: "La commande n’a pas pu être modifiée. Réessayez." };
  if (fields.measurements.length && JSON.stringify(fields.measurements) !== JSON.stringify(before.data.measurements) && before.data.client_id)
    await context.supabase.from("client_measurements").insert({ workshop_id: workshop.id, client_id: before.data.client_id, garment_type: fields.garment_type, measurements: fields.measurements });
  return { error: null };
});

export const getOrder = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const r = await context.supabase.from("orders").select("*, client:clients(id, full_name, phone)").eq("id", data.id).maybeSingle();
  if (r.error) throw new Error("Cette commande n’a pas pu être chargée.");
  if (!r.data) return null;
  const urls: Record<string, string | null> = { model: null, fabric: null };
  for (const [k, path] of [["model", r.data.model_photo_path], ["fabric", r.data.fabric_photo_path]] as const) {
    if (path) { const s = await context.supabase.storage.from("order-photos").createSignedUrl(path, 3600); urls[k] = s.data?.signedUrl ?? null; }
  }
  return { ...r.data, photoUrls: urls };
});

export const updateOrderStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid(), status: z.enum(statusValues) })).handler(async ({ data, context }) => {
  const workshop = await myWorkshop(context);
  const subscription = await fetchWorkshopSubscription(context.supabase, workshop.id);
  if (subscription.error) return { error: "Le statut n’a pas pu être modifié." };
  const planAccess = resolveSubscriptionAccess(subscription.data);
  if (!planAccess.canManage) return { error: readOnlyMessage(planAccess) };
  const r = await context.supabase.from("orders").update({ status: data.status }).eq("id", data.id).eq("workshop_id", workshop.id).select("id").maybeSingle();
  if (r.error) {
    const isReadOnlyError = r.error.message.includes("essai gratuit") || r.error.message.includes("abonnement");
    return { error: isReadOnlyError ? readOnlyMessage(planAccess) : "Le statut n’a pas pu être modifié." };
  }
  if (!r.data) return { error: "Le statut n’a pas pu être modifié." };
  return { error: null };
});

export const getClientHistory = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const [orders, measurements] = await Promise.all([
    context.supabase.from("orders").select("id, order_number, garment_type, status, delivery_date, total_price, balance").eq("client_id", data.id).order("order_number", { ascending: false }),
    context.supabase.from("client_measurements").select("id, garment_type, measurements, taken_at").eq("client_id", data.id).order("taken_at", { ascending: false }),
  ]);
  if (orders.error || measurements.error) throw new Error("L’historique n’a pas pu être chargé.");
  return { orders: orders.data ?? [], measurements: measurements.data ?? [] };
});
