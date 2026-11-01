import { z } from "zod";

export const FREE_CLIENT_MESSAGE = "Vous avez atteint la limite de 5 clients de la formule gratuite. Passez à l'abonnement Mensuel (2 000 FCFA) ou Annuel (15 000 FCFA) pour enregistrer des clients illimités.";
export const clientSchema = z.object({
  full_name: z.string().trim().min(1, "Le nom complet est obligatoire.").max(100, "Le nom est limité à 100 caractères."),
  phone: z.string().trim().min(1, "Le numéro de téléphone est obligatoire.").max(30).regex(/^\+?[0-9 ()-]+$/, "Saisissez un numéro de téléphone valide.").refine((value) => { const digits = value.replace(/\D/g, ""); return digits.length >= 8 && digits.length <= 15; }, "Le téléphone doit contenir entre 8 et 15 chiffres."),
  address: z.string().trim().max(300, "L’adresse est limitée à 300 caractères."),
  notes: z.string().trim().max(2000, "Les notes sont limitées à 2 000 caractères."),
});
export type ClientInput = z.infer<typeof clientSchema>;
export function matchesClient(client: { full_name: string; phone: string | null }, search: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  const term = normalize(search.trim());
  const digits = search.replace(/\D/g, "");
  return normalize(client.full_name).includes(term) || normalize(client.phone ?? "").includes(term) || (digits.length > 0 && /^[+\d\s()-]+$/.test(search) && (client.phone ?? "").replace(/\D/g, "").includes(digits));
}