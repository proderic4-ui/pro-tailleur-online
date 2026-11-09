import { describe, expect, it } from "vitest";
import { dashboardStats, lomeDay, type DashboardOrder } from "@/lib/dashboard";

const now = new Date("2026-11-09T23:30:00Z");
function order(id: number, status: string, date: string | null, deposit = 5000, balance = 10000): DashboardOrder {
  return { id: String(id), order_number: id, garment_type: "Chemise", status, delivery_date: date, deposit, balance, client: { full_name: "Client" } };
}

describe("indicateurs de l’atelier", () => {
  it("compte toutes les commandes non livrées, y compris annulées", () => {
    expect(dashboardStats([order(1, "new", null), order(2, "cancelled", null), order(3, "delivered", null)], now).inProgress).toBe(2);
  });
  it("compte les commandes prêtes à récupérer", () => {
    expect(dashboardStats([order(1, "ready", null), order(2, "new", null)], now).ready).toBe(1);
  });
  it("compte les commandes livrées", () => {
    expect(dashboardStats([order(1, "delivered", null), order(2, "ready", null)], now).delivered).toBe(1);
  });
  it("retard : date dépassée et uniquement statut non livré", () => {
    const result = dashboardStats([order(1, "new", "2026-11-08"), order(2, "cancelled", "2026-11-07"), order(3, "delivered", "2026-11-08"), order(4, "ready", "2026-11-09")], now);
    expect(result.late).toBe(2);
    expect(result.overdue.map((o) => o.id)).toEqual(["2", "1"]);
  });
  it("additionne tous les acomptes manuels", () => {
    expect(dashboardStats([order(1, "new", null, 5000), order(2, "delivered", null, 7000), order(3, "cancelled", null, 2000)], now).deposits).toBe(14000);
  });
  it("additionne les soldes uniquement des commandes non livrées", () => {
    expect(dashboardStats([order(1, "new", null, 0, 10000), order(2, "delivered", null, 0, 15000), order(3, "cancelled", null, 0, 2000)], now).remaining).toBe(12000);
  });
  it("livraison proche : aujourd’hui à J+3 inclus, triée par date", () => {
    const result = dashboardStats([order(1, "ready", "2026-11-12"), order(2, "new", "2026-11-09"), order(3, "new", "2026-11-13"), order(4, "delivered", "2026-11-10"), order(5, "new", null), order(6, "new", "2026-11-08")], now);
    expect(result.upcoming.map((o) => o.id)).toEqual(["2", "1"]);
  });
  it("calcule le jour à Lomé même si le navigateur est déjà au lendemain", () => {
    expect(lomeDay(new Date("2026-11-10T00:30:00+09:00"))).toBe("2026-11-09");
    expect(dashboardStats([order(1, "new", "2026-11-09")], new Date("2026-11-10T00:30:00+09:00")).late).toBe(0);
  });
  it("bascule le retard à minuit à Lomé", () => {
    const orders = [order(1, "new", "2026-11-09")];
    expect(dashboardStats(orders, new Date("2026-11-09T23:59:59Z")).late).toBe(0);
    expect(dashboardStats(orders, new Date("2026-11-10T00:00:00Z")).late).toBe(1);
  });
  it("atelier vide : montants et compteurs nuls, listes vides", () => {
    expect(dashboardStats([], now)).toEqual({ inProgress: 0, ready: 0, delivered: 0, late: 0, deposits: 0, remaining: 0, upcoming: [], overdue: [] });
  });
});