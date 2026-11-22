import { describe, expect, it } from "vitest";
import { FREE_CLIENT_LIMIT, FREE_ORDER_LIMIT, FREE_ORDER_MESSAGE, GARMENT_TYPES, balance, deliveryAlert, isFreeOrderLimitReached, isPaidSubscription, orderSchema } from "@/lib/garments";

const base = { client_id: "6f1b0f8e-2a4e-4c1e-9f1a-1b2c3d4e5f60", garment_type: "Chemise", description: "", colors: "", finishes: "", notes: "", measurements: [], delivery_date: "2030-01-01", total_price: 20000, deposit: 5000, model_photo_path: null, fabric_photo_path: null };
describe("commandes", () => {
  it("formule gratuite : 10 clients, 5 commandes", () => {
    expect(FREE_CLIENT_LIMIT).toBe(10);
    expect(FREE_ORDER_LIMIT).toBe(5);
    expect(FREE_ORDER_MESSAGE).toContain("5 commandes");
  });
  it("autorise jusqu'à la 5e commande et bloque la 6e en formule gratuite", () => {
    expect(isFreeOrderLimitReached(0, FREE_ORDER_LIMIT)).toBe(false);
    expect(isFreeOrderLimitReached(3, FREE_ORDER_LIMIT)).toBe(false);
    expect(isFreeOrderLimitReached(4, FREE_ORDER_LIMIT)).toBe(false); // 5e commande autorisée
    expect(isFreeOrderLimitReached(5, FREE_ORDER_LIMIT)).toBe(true); // 6e commande bloquée
    expect(isFreeOrderLimitReached(25, null)).toBe(false); // formules payantes illimitées
  });
  it("distingue formule gratuite, essai actif et formules payantes confirmées", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    expect(isPaidSubscription({ plan: "free", status: "active", starts_at: "2026-01-01T00:00:00Z", ends_at: null, payment_confirmed: false }, now)).toBe(false);
    expect(isPaidSubscription({ plan: "simple", status: "trial", starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z", payment_confirmed: false }, now)).toBe(false);
    expect(isPaidSubscription({ plan: "pro", status: "active", starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z", payment_confirmed: true }, now)).toBe(true);
    expect(isPaidSubscription({ plan: "gold", status: "active", starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z", payment_confirmed: false }, now)).toBe(false);
    expect(isPaidSubscription({ plan: "simple", status: "trial", starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-11-01T00:00:00Z", payment_confirmed: false }, now)).toBe(false);
  });
  it("solde = prix total - acompte", () => expect(balance(20000, 5000)).toBe(15000));
  it("refuse un acompte supérieur au prix", () => expect(orderSchema.safeParse({ ...base, deposit: 25000 }).success).toBe(false));
  it("exige un client", () => expect(orderSchema.safeParse({ ...base, client_id: "" }).success).toBe(false));
  it("mesures chemise et pantalon", () => {
    expect(GARMENT_TYPES["Chemise"]).toEqual(["Tour de cou", "Poitrine", "Épaules", "Longueur du vêtement", "Longueur des manches", "Tour de poignet"]);
    expect(GARMENT_TYPES["Pantalon"]).toEqual(["Taille", "Hanches", "Longueur", "Entrejambe", "Cuisse", "Genou", "Cheville"]);
  });
  it("repère retard et livraison proche", () => {
    const today = new Date(2026, 10, 10);
    expect(deliveryAlert({ delivery_date: "2026-11-09", status: "new" }, today)).toBe("late");
    expect(deliveryAlert({ delivery_date: "2026-11-12", status: "new" }, today)).toBe("soon");
    expect(deliveryAlert({ delivery_date: "2026-11-30", status: "new" }, today)).toBeNull();
    expect(deliveryAlert({ delivery_date: "2026-11-09", status: "delivered" }, today)).toBeNull();
  });
});

import { orderUpdateSchema } from "@/lib/garments";
describe("modification de commande", () => {
  const { client_id: _c, ...rest } = base;
  const upd = { ...rest, id: "6f1b0f8e-2a4e-4c1e-9f1a-1b2c3d4e5f61" };
  it("n'accepte pas de changement de client", () => { const r = orderUpdateSchema.safeParse({ ...upd, client_id: "6f1b0f8e-2a4e-4c1e-9f1a-1b2c3d4e5f62" }); expect(r.success && "client_id" in r.data).toBe(false); });
  it("exige l'identifiant de la commande", () => expect(orderUpdateSchema.safeParse(rest).success).toBe(false));
  it("refuse un acompte supérieur au prix", () => expect(orderUpdateSchema.safeParse({ ...upd, deposit: 25000 }).success).toBe(false));
});
