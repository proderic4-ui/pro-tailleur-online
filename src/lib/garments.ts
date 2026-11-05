import { z } from "zod";

export const FREE_CLIENT_LIMIT = 10;
export const FREE_ORDER_LIMIT = 3;
export const FREE_ORDER_MESSAGE = "Vous avez atteint la limite de 3 commandes de la formule gratuite. Passez à l'abonnement Mensuel (2 000 FCFA) ou Annuel (15 000 FCFA) pour enregistrer des commandes illimitées.";

const shirt = ["Tour de cou", "Poitrine", "Épaules", "Longueur du vêtement", "Longueur des manches", "Tour de poignet"];
const trousers = ["Taille", "Hanches", "Longueur", "Entrejambe", "Cuisse", "Genou", "Cheville"];
export const GARMENT_TYPES: Record<string, string[]> = {
  "Chemise": shirt,
  "Pantalon": trousers,
  "Chemise et pantalon / ensemble": [...shirt, ...trousers.map((m) => `${m} (pantalon)`)],
  "Costume": ["Poitrine", "Taille", "Épaules", "Longueur de la veste", "Longueur des manches", "Tour de poignet", "Hanches", "Longueur du pantalon", "Entrejambe", "Cuisse", "Cheville"],
  "Veste": ["Poitrine", "Taille", "Épaules", "Longueur de la veste", "Longueur des manches", "Tour de poignet"],
  "Short": ["Taille", "Hanches", "Longueur", "Cuisse"],
  "Robe": ["Poitrine", "Taille", "Hanches", "Épaules", "Longueur de la robe", "Longueur des manches", "Tour de bras"],
  "Jupe": ["Taille", "Hanches", "Longueur de la jupe"],
  "Tenue traditionnelle / boubou": ["Poitrine", "Épaules", "Longueur du vêtement", "Longueur des manches", "Tour de cou", "Taille", "Longueur du pantalon"],
  "Autre": [],
};

export const ORDER_STATUSES = [
  { value: "new", label: "Nouvelle commande" },
  { value: "waiting", label: "En attente d'informations ou de tissu" },
  { value: "in_progress", label: "En cours de confection" },
  { value: "finishing", label: "En finition" },
  { value: "ready", label: "Prête à récupérer" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];
export const statusValues = ORDER_STATUSES.map((s) => s.value) as [OrderStatus, ...OrderStatus[]];
export const statusLabel = (value: string) => ORDER_STATUSES.find((s) => s.value === value)?.label ?? value;

export const measurementSchema = z.object({ label: z.string().trim().min(1).max(60), value: z.number().positive("Les mesures doivent être positives.").max(500, "Mesure trop grande."), unit: z.literal("cm") });
const amount = z.number().int("Montant en FCFA entier.").min(0, "Le montant ne peut pas être négatif.").max(100_000_000);
const orderFields = z.object({
  client_id: z.string().uuid("Choisissez un client."),
  garment_type: z.string().trim().min(1, "Choisissez un type de vêtement.").max(60),
  description: z.string().trim().max(2000),
  colors: z.string().trim().max(300),
  finishes: z.string().trim().max(1000),
  measurements: z.array(measurementSchema).max(40),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indiquez la date de livraison."),
  total_price: amount,
  deposit: amount,
  notes: z.string().trim().max(2000),
  model_photo_path: z.string().max(200).nullable(),
  fabric_photo_path: z.string().max(200).nullable(),
});
const depositOk = (o: { deposit: number; total_price: number }) => o.deposit <= o.total_price;
const depositMsg = () => ({ message: "L'acompte ne peut pas dépasser le prix total.", path: ["deposit"] });
export const orderSchema = orderFields.refine(depositOk, depositMsg());
/** Edit: client, number and creation date are never editable. */
export const orderUpdateSchema = orderFields.omit({ client_id: true }).extend({ id: z.string().uuid() }).refine(depositOk, depositMsg());
export type OrderInput = z.infer<typeof orderSchema>;

export const balance = (total: number, deposit: number) => total - deposit;

/** "late" if delivery date passed and not delivered/cancelled; "soon" if within 3 days. */
export function deliveryAlert(order: { delivery_date: string | null; status: string }, today = new Date()) {
  if (!order.delivery_date || order.status === "delivered" || order.status === "cancelled") return null;
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = order.delivery_date.split("-").map(Number);
  const days = Math.round((Date.UTC(y!, m! - 1, d!) - start) / 86_400_000);
  if (days < 0) return "late" as const;
  if (days <= 3) return "soon" as const;
  return null;
}
export const fcfa = (n: number) => `${n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} FCFA`;
