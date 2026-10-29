import { describe, expect, it } from "vitest";
import { signupSchema } from "@/lib/auth-validation";
const valid = { full_name: "Tailleur Test", workshop_name: "Atelier Test", phone: "+22890123456", email: "tailleur@example.com", password: "Example-9284", confirmation: "Example-9284" };
describe("Inscription tailleur", () => {
  it("accepte un profil complet", () => expect(signupSchema.safeParse(valid).success).toBe(true));
  for (const field of ["full_name", "workshop_name", "phone", "email", "password", "confirmation"]) {
    it(`exige ${field}`, () => expect(signupSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false));
  }
  it("exige l’indicatif +228", () => expect(signupSchema.safeParse({ ...valid, phone: "+22990123456" }).success).toBe(false));
  it("exige 8 chiffres après +228", () => expect(signupSchema.safeParse({ ...valid, phone: "+2289012345" }).success).toBe(false));
  it("exige une confirmation identique", () => expect(signupSchema.safeParse({ ...valid, confirmation: "Different-9284" }).success).toBe(false));
});