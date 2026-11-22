import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dashboardStats, type DashboardOrder } from "./dashboard";
import { fetchWorkshopSubscription, resolveSubscriptionAccess } from "./plans";

export const getMyWorkshop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: workshop, error } = await context.supabase.from("workshops").select("id, name, created_at").eq("owner_id", context.userId).single();
    if (error || !workshop) throw new Error("Votre atelier n’a pas pu être chargé.");
    const [profile, subscription, clients, orders, dashboardOrders] = await Promise.all([
      context.supabase.from("profiles").select("full_name, phone").eq("id", context.userId).single(),
      fetchWorkshopSubscription(context.supabase, workshop.id),
      context.supabase.from("clients").select("id", { count: "exact", head: true }).eq("workshop_id", workshop.id),
      context.supabase.from("orders").select("id", { count: "exact", head: true }).eq("workshop_id", workshop.id),
      context.supabase.from("orders").select("id, order_number, garment_type, status, delivery_date, deposit, balance, client:clients(full_name)").eq("workshop_id", workshop.id),
    ]);
    if (profile.error || subscription.error || clients.error || orders.error || dashboardOrders.error) throw new Error("Les informations de votre atelier n’ont pas pu être chargées.");
    const plan = subscription.data;
    const planAccess = resolveSubscriptionAccess(plan);
    const stats = dashboardStats((dashboardOrders.data ?? []) as DashboardOrder[], new Date());
    return {
      workshop,
      profile: profile.data,
      subscription: plan,
      planAccess,
      clients: clients.count ?? 0,
      orders: orders.count ?? 0,
      clientLimit: planAccess.clientLimit,
      orderLimit: planAccess.orderLimit,
      stats,
    };
  });