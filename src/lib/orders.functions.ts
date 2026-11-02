import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FREE_ORDER_MESSAGE, orderSchema, statusValues } from "./garments";

type Ctx = { supabase: any; userId: string };
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
    context.supabase.from("subscriptions").select("plan, status, starts_at, ends_at").eq("workshop_id", workshop.id).single(),
  ]);
  if (orders.error || subscription.error) throw new Error("Vos commandes n’ont pas pu être chargées.");
  const p = subscription.data; const now = Date.now();
  const paid = p && ["monthly", "annual"].includes(p.plan) && p.status === "active" && Date.parse(p.starts_at) <= now && p.ends_at && Date.parse(p.ends_at) > now;
  return { workshop, orders: orders.data ?? [], limit: paid ? null : 3 };
});

export const getOrderFormData = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const workshop = await myWorkshop(context);
  const [clients, categories, measurements] = await Promise.all([
    context.supabase.from("clients").select("id, full_name, phone").eq("workshop_id", workshop.id).order("full_name"),
    context.supabase.from("garment_categories").select("id, name, measurement_labels").eq("workshop_id", workshop.id).order("name"),
    context.supabase.from("client_measurements").select("client_id, garment_type, measurements, taken_at").eq("workshop_id", workshop.id).order("taken_at", { ascending: false }).limit(500),
  ]);
  if (clients.error || categories.error || measurements.error) throw new Error("Le formulaire n’a pas pu être chargé.");
  return { workshopId: workshop.id, clients: clients.data ?? [], categories: categories.data ?? [], measurements: measurements.data ?? [] };
});

export const addGarmentCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().trim().min(1, "Nom obligatoire.").max(60), measurement_labels: z.array(z.string().trim().min(1).max(60)).max(30) }))
  .handler(async ({ data, context }) => {
    const workshop = await myWorkshop(context);
    const r = await context.supabase.from("garment_categories").insert({ ...data, workshop_id: workshop.id }).select("id, name, measurement_labels").single();
    if (r.error) return { category: null, error: r.error.code === "23505" ? "Ce modèle existe déjà." : "Le modèle n’a pas pu être enregistré." };
    return { category: r.data, error: null };
  });

export const createOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(orderSchema).handler(async ({ data, context }) => {
  const workshop = await myWorkshop(context);
  for (const path of [data.model_photo_path, data.fabric_photo_path]) if (path && !path.startsWith(`${workshop.id}/`)) return { id: null, error: "Photo invalide." };
  const result = await context.supabase.from("orders").insert({ ...data, title: data.garment_type, workshop_id: workshop.id, status: "new" }).select("id").single();
  if (result.error) return { id: null, error: result.error.message.includes("3 maximum") ? FREE_ORDER_MESSAGE : "La commande n’a pas pu être enregistrée. Vérifiez le client choisi et réessayez." };
  // Dated measurement history; the order keeps its own frozen copy.
  if (data.measurements.length) await context.supabase.from("client_measurements").insert({ workshop_id: workshop.id, client_id: data.client_id, garment_type: data.garment_type, measurements: data.measurements });
  return { id: result.data.id as string, error: null };
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
  const r = await context.supabase.from("orders").update({ status: data.status }).eq("id", data.id).select("id").maybeSingle();
  if (r.error || !r.data) return { error: "Le statut n’a pas pu être modifié." };
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
