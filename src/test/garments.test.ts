import { describe, expect, it } from "vitest";
import { FREE_CLIENT_LIMIT, FREE_ORDER_LIMIT, GARMENT_TYPES, balance, deliveryAlert, orderSchema } from "@/lib/garments";

const base = { client_id: "6f1b0f8e-2a4e-4c1e-9f1a-1b2c3d4e5f60", garment_type: "Chemise", description: "", colors: "", finishes: "", notes: "", measurements: [], delivery_date: "2030-01-01", total_price: 20000, deposit: 5000, model_photo_path: null, fabric_photo_path: null };
describe("commandes", () => {
  it("formule gratuite : 10 clients, 3 commandes", () => { expect(FREE_CLIENT_LIMIT).toBe(10); expect(FREE_ORDER_LIMIT).toBe(3); });
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
