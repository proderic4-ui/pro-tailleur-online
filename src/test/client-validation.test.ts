import { describe, expect, it } from "vitest";
import { clientSchema, matchesClient } from "@/lib/client-validation";
const valid = { full_name: "Afi Mensah", phone: "+228 90 12 34 56", address: "", notes: "" };
describe("Informations clients", () => {
  it("exige un nom complet", () => { expect(clientSchema.safeParse({ ...valid, full_name: " " }).success).toBe(false); });
  it("exige un téléphone", () => { expect(clientSchema.safeParse({ ...valid, phone: "" }).success).toBe(false); });
  it("accepte une adresse et des notes vides", () => { expect(clientSchema.parse(valid)).toEqual(valid); });
  it("retrouve un client par son nom", () => { expect(matchesClient(valid, "mensah")).toBe(true); expect(matchesClient(valid, "Koffi")).toBe(false); });
  it("retrouve un numéro sans ses espaces", () => { expect(matchesClient(valid, "90123456")).toBe(true); expect(matchesClient(valid, "99123456")).toBe(false); });
});