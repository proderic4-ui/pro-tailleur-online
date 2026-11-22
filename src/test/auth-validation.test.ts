import { describe, expect, it } from "vitest";
import {
  combineFullName,
  namePartSchema,
  optionalWorkshopEmailSchema,
  optionalWorkshopPhoneSchema,
  resolveCountrySelection,
  resolveFinalCountry,
  selectablePlanSchema,
  SIGNUP_COUNTRIES,
  signupSchema,
  workshopCountrySchema,
} from "@/lib/auth-validation";
const valid = { full_name: "Tailleur Test", workshop_name: "Atelier Test", phone: "+22890123456", email: "tailleur@example.com", password: "Example-9284", confirmation: "Example-9284" };
describe("Inscription tailleur", () => {
  it("accepte un profil complet avec champs facultatifs vides", () => {
    const res = signupSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.workshop_country).toBe("Togo");
      expect(res.data.workshop_address).toBe("");
      expect(res.data.workshop_city).toBe("");
      expect(res.data.workshop_phone).toBe("");
      expect(res.data.workshop_email).toBe("");
      expect(res.data.workshop_description).toBe("");
    }
  });
  for (const field of ["full_name", "workshop_name", "phone", "email", "password", "confirmation"]) {
    it(`exige ${field}`, () => expect(signupSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false));
  }
  it("exige prénom et nom du responsable et assemble full_name", () => {
    expect(namePartSchema.safeParse({ first_name: "Koffi", last_name: "Mensah" }).success).toBe(true);
    expect(namePartSchema.safeParse({ first_name: "", last_name: "Mensah" }).success).toBe(false);
    expect(namePartSchema.safeParse({ first_name: "Koffi", last_name: "" }).success).toBe(false);
    expect(combineFullName(" Koffi ", " Mensah ")).toBe("Koffi Mensah");
  });
  it("exige l’indicatif +228 pour le téléphone du responsable", () => expect(signupSchema.safeParse({ ...valid, phone: "+22990123456" }).success).toBe(false));
  it("exige 8 chiffres après +228 pour le téléphone du responsable", () => expect(signupSchema.safeParse({ ...valid, phone: "+2289012345" }).success).toBe(false));
  it("exige une confirmation identique", () => expect(signupSchema.safeParse({ ...valid, confirmation: "Different-9284" }).success).toBe(false));
  it("accepte uniquement les formules simple, pro et gold et exige une sélection explicite", () => {
    for (const plan of ["simple", "pro", "gold"] as const) {
      expect(signupSchema.safeParse({ ...valid, plan }).success).toBe(true);
      expect(selectablePlanSchema.safeParse(plan).success).toBe(true);
    }
    expect(selectablePlanSchema.safeParse(null).success).toBe(false);
    expect(selectablePlanSchema.safeParse("free").success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, plan: "free" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, plan: "annual" }).success).toBe(false);
  });

  it("gère la liste des pays, Autre et la réouverture d’un pays enregistré", () => {
    expect(SIGNUP_COUNTRIES).toEqual(["Togo", "Sénégal", "Mali", "Côte d’Ivoire"]);
    expect(resolveCountrySelection(undefined)).toEqual({ selectedCountry: "Togo", customCountry: "" });
    expect(resolveCountrySelection("Mali")).toEqual({ selectedCountry: "Mali", customCountry: "" });
    expect(resolveCountrySelection("Côte d'Ivoire")).toEqual({ selectedCountry: "Côte d’Ivoire", customCountry: "" });
    expect(resolveCountrySelection("Bénin")).toEqual({ selectedCountry: "Autre", customCountry: "Bénin" });
    expect(resolveFinalCountry("Autre", " Bénin ")).toBe("Bénin");
    expect(resolveFinalCountry("Sénégal", "Bénin")).toBe("Sénégal");
    expect(workshopCountrySchema.safeParse("Autre").success).toBe(false);
    expect(workshopCountrySchema.safeParse("").success).toBe(false);
    expect(workshopCountrySchema.safeParse("Bénin").success).toBe(true);
  });

  it("valide le téléphone de l’atelier (facultatif et multi-pays) et l’e-mail de l’atelier", () => {
    expect(optionalWorkshopPhoneSchema.safeParse("").success).toBe(true);
    expect(optionalWorkshopPhoneSchema.safeParse("+221 77 123 45 67").success).toBe(true);
    expect(optionalWorkshopPhoneSchema.safeParse("+223 70 12 34 56").success).toBe(true);
    expect(optionalWorkshopPhoneSchema.safeParse("+225 07 01 02 03 04").success).toBe(true);
    expect(optionalWorkshopPhoneSchema.safeParse("+228 90 12 34 56").success).toBe(true);
    expect(optionalWorkshopPhoneSchema.safeParse("123").success).toBe(false);
    expect(optionalWorkshopPhoneSchema.safeParse("abc").success).toBe(false);

    expect(optionalWorkshopEmailSchema.safeParse("").success).toBe(true);
    expect(optionalWorkshopEmailSchema.safeParse("atelier@exemple.tg").success).toBe(true);
    expect(optionalWorkshopEmailSchema.safeParse("invalide").success).toBe(false);
  });
});