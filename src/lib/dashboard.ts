export type DashboardOrder = {
  id: string;
  order_number: number;
  garment_type: string;
  status: string;
  delivery_date: string | null;
  deposit: number;
  balance: number;
  client: { full_name: string } | null;
};

const DAY_MS = 86_400_000;

export function lomeDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function dashboardStats(orders: DashboardOrder[], now: Date) {
  const today = Date.parse(`${lomeDay(now)}T00:00:00Z`);
  const pending = orders.filter((order) => order.status !== "delivered");
  const daysUntil = (order: DashboardOrder) => order.delivery_date
    ? (Date.parse(`${order.delivery_date}T00:00:00Z`) - today) / DAY_MS
    : Number.NaN;
  const byDate = (a: DashboardOrder, b: DashboardOrder) =>
    (a.delivery_date ?? "").localeCompare(b.delivery_date ?? "") || a.order_number - b.order_number;
  const upcoming = pending.filter((order) => daysUntil(order) >= 0 && daysUntil(order) <= 3).sort(byDate);
  const overdue = pending.filter((order) => daysUntil(order) < 0).sort(byDate);
  return {
    inProgress: pending.length,
    ready: orders.filter((order) => order.status === "ready").length,
    delivered: orders.filter((order) => order.status === "delivered").length,
    late: overdue.length,
    deposits: orders.reduce((sum, order) => sum + order.deposit, 0),
    remaining: pending.reduce((sum, order) => sum + order.balance, 0),
    upcoming,
    overdue,
  };
}

export function dashboardDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Lome" })
    .format(new Date(`${date}T00:00:00Z`));
}