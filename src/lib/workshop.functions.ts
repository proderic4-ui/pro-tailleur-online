import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dashboardStats, type DashboardOrder } from "./dashboard";

export const getMyWorkshop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: workshop, error } = await context.supabase.from("workshops").select("id, name, created_at").eq("owner_id", context.userId).single();
    if (error || !workshop) throw new Error("Votre atelier n’a pas pu être chargé.");
    const [profile, subscription, clients, orders, dashboardOrders] = await Promise.all([
      context.supabase.from("profiles").select("full_name, phone").eq("id", context.userId).single(),
      context.supabase.from("subscriptions").select("plan, status, starts_at, ends_at").eq("workshop_id", workshop.id).single(),
      context.supabase.from("clients").select("id", { count: "exact", head: true }).eq("workshop_id", workshop.id),
      context.supabase.from("orders").select("id", { count: "exact", head: true }).eq("workshop_id", workshop.id),
      context.supabase.from("orders").select("id, order_number, garment_type, status, delivery_date, deposit, balance, client:clients(full_name)").eq("workshop_id", workshop.id),
    ]);
    if (profile.error || subscription.error || clients.error || orders.error || dashboardOrders.error) throw new Error("Les informations de votre atelier n’ont pas pu être chargées.");
    const plan = subscription.data;
    const paid = plan && ["monthly", "annual"].includes(plan.plan) && plan.status === "active" && new Date(plan.starts_at) <= new Date() && plan.ends_at && new Date(plan.ends_at) > new Date();
    const stats = dashboardStats((dashboardOrders.data ?? []) as DashboardOrder[], new Date());
    return { workshop, profile: profile.data, subscription: plan, clients: clients.count ?? 0, orders: orders.count ?? 0, clientLimit: paid ? null : 10, orderLimit: paid ? null : 3, stats };
  });