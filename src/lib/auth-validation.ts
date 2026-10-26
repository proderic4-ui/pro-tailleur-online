import { z } from "zod";

export const emailSchema = z.string().trim().email("Adresse e-mail invalide.").max(255);
export const passwordSchema = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(128);
export const signupSchema = z.object({
  full_name: z.string().trim().min(1, "Le nom complet est obligatoire.").max(100),
  workshop_name: z.string().trim().min(1, "Le nom de l’atelier est obligatoire.").max(120),
  phone: z.string().transform((value) => value.replace(/[\s-]/g, "")).refine((value) => /^\+228\d{8}$/.test(value), "Saisissez +228 suivi de 8 chiffres."),
  email: emailSchema,
  password: passwordSchema,
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, { message: "Les mots de passe ne correspondent pas.", path: ["confirmation"] });

export function authError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Adresse e-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirmez votre adresse e-mail avant de vous connecter.";
  if (/already registered|already been registered/i.test(message)) return "Cette adresse e-mail possède déjà un compte.";
  if (/rate limit|too many|after.*seconds/i.test(message)) return "Trop de demandes. Patientez quelques minutes avant de réessayer.";
  if (/password.*(weak|short)|weak.*password/i.test(message)) return "Choisissez un mot de passe plus long et plus sécurisé.";
  return "La demande n’a pas abouti. Veuillez réessayer.";
}