import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SignupForm } from "@/components/site/SignupForm";
import type { SelectablePlanId } from "@/lib/plans";

export const Route = createFileRoute("/inscription")({
  validateSearch: (search): { formule?: SelectablePlanId } => {
    const parsed = z.enum(["simple", "pro", "gold"]).safeParse(search["formule"]);
    return parsed.success ? { formule: parsed.data } : {};
  },
  head: () => ({
    meta: [
      { title: "Créer un compte — Pro Tailleur Online" },
      { name: "description", content: "Inscrivez votre atelier sur Pro Tailleur Online et démarrez votre Essai gratuit — 1 mois sur Simple, Pro ou Gold." },
      { property: "og:title", content: "Créer un compte — Pro Tailleur Online" },
      { property: "og:description", content: "Démarrez votre Essai gratuit — 1 mois (100 clients et 100 commandes max), aucun paiement demandé aujourd’hui." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InscriptionPage,
});

function InscriptionPage() {
  const { formule } = Route.useSearch();
  return <SignupForm initialPlan={formule} />;
}
