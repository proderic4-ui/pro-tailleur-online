import { z } from "zod";

export const SIGNUP_COUNTRIES = ["Togo", "Sénégal", "Mali", "Côte d’Ivoire"] as const;
export const DEFAULT_SIGNUP_COUNTRY = "Togo";
export const OTHER_COUNTRY_OPTION = "Autre";

function normalizeCountryKey(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "'")
    .toLocaleLowerCase("fr");
}

export function resolveCountrySelection(savedCountry?: string | null): {
  selectedCountry: (typeof SIGNUP_COUNTRIES)[number] | typeof OTHER_COUNTRY_OPTION;
  customCountry: string;
} {
  const trimmed = (savedCountry ?? "").trim();
  if (!trimmed) {
    return { selectedCountry: DEFAULT_SIGNUP_COUNTRY, customCountry: "" };
  }
  const normalized = normalizeCountryKey(trimmed);
  if (normalized === "autre") {
    return { selectedCountry: OTHER_COUNTRY_OPTION, customCountry: "" };
  }
  const matched = SIGNUP_COUNTRIES.find((c) => normalizeCountryKey(c) === normalized);
  if (matched) {
    return { selectedCountry: matched, customCountry: "" };
  }
  return { selectedCountry: OTHER_COUNTRY_OPTION, customCountry: trimmed };
}

export function resolveFinalCountry(selectedCountry: string, customCountry: string): string {
  if (selectedCountry === OTHER_COUNTRY_OPTION) {
    return customCountry.trim();
  }
  return selectedCountry.trim();
}

export const emailSchema = z.string().trim().email("Adresse e-mail invalide.").max(255);
export const passwordSchema = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(128);
export const selectablePlanSchema = z.enum(["simple", "pro", "gold"], {
  message: "Veuillez sélectionner une formule : Simple, Pro ou Gold.",
});
export const namePartSchema = z.object({
  first_name: z.string().trim().min(1, "Le prénom est obligatoire.").max(50, "Le prénom est trop long."),
  last_name: z.string().trim().min(1, "Le nom est obligatoire.").max(50, "Le nom est trop long."),
}).refine(
  (v) => `${v.first_name.trim()} ${v.last_name.trim()}`.length <= 100,
  { message: "Le prénom et le nom réunis ne doivent pas dépasser 100 caractères.", path: ["last_name"] },
);

export function combineFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export const workshopCountrySchema = z
  .string()
  .trim()
  .min(1, "Veuillez saisir le nom du pays.")
  .max(100, "Le nom du pays est limité à 100 caractères.")
  .refine(
    (v) => normalizeCountryKey(v) !== "autre",
    "Veuillez saisir le nom du pays plutôt que « Autre ».",
  );

export const optionalWorkshopPhoneSchema = z
  .string()
  .trim()
  .max(30, "Le téléphone de l’atelier est limité à 30 caractères.")
  .refine(
    (v) => v === "" || /^\+?[0-9 ()-]+$/.test(v),
    "Saisissez un numéro de téléphone d’atelier valide.",
  )
  .refine(
    (v) => {
      if (v === "") return true;
      const digits = v.replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15;
    },
    "Le téléphone de l’atelier doit contenir entre 8 et 15 chiffres.",
  );

export const optionalWorkshopEmailSchema = z
  .string()
  .trim()
  .max(255, "L’e-mail de l’atelier est limité à 255 caractères.")
  .refine(
    (v) => v === "" || emailSchema.safeParse(v).success,
    "Adresse e-mail de l’atelier invalide.",
  );

export const signupSchema = z.object({
  full_name: z.string().trim().min(1, "Le nom complet est obligatoire.").max(100),
  workshop_name: z.string().trim().min(1, "Le nom de l’atelier est obligatoire.").max(120, "Le nom de l’atelier est limité à 120 caractères."),
  workshop_address: z.string().trim().max(300, "L’adresse physique est limitée à 300 caractères.").default(""),
  workshop_city: z.string().trim().max(100, "La ville est limitée à 100 caractères.").default(""),
  workshop_country: workshopCountrySchema.default(DEFAULT_SIGNUP_COUNTRY),
  workshop_phone: optionalWorkshopPhoneSchema.default(""),
  workshop_email: optionalWorkshopEmailSchema.default(""),
  workshop_description: z.string().trim().max(2000, "La description est limitée à 2 000 caractères.").default(""),
  phone: z.string().transform((value) => value.replace(/[\s-]/g, "")).refine((value) => /^\+228\d{8}$/.test(value), "Saisissez +228 suivi de 8 chiffres."),
  email: emailSchema,
  password: passwordSchema,
  confirmation: z.string(),
  plan: selectablePlanSchema.default("pro"),
}).refine((value) => value.password === value.confirmation, { message: "Les mots de passe ne correspondent pas.", path: ["confirmation"] });

export function authError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Adresse e-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirmez votre adresse e-mail avant de vous connecter.";
  if (/already registered|already been registered/i.test(message)) return "Cette adresse e-mail possède déjà un compte.";
  if (/rate limit|too many|after.*seconds/i.test(message)) return "Trop de demandes. Patientez quelques minutes avant de réessayer.";
  if (/password.*(weak|short)|weak.*password/i.test(message)) return "Choisissez un mot de passe plus long et plus sécurisé.";
  return "La demande n’a pas abouti. Veuillez réessayer.";
}