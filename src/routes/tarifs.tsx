import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/ui";
import { Pricing } from "@/components/site/sections";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Abonnements — Pro Tailleur Online" },
      { name: "description", content: "Simple 2 500 FCFA/mois, Pro 5 000 FCFA/mois ou Gold 7 500 FCFA/mois avec Essai gratuit — 1 mois (100 clients et 100 commandes max), sans paiement maintenant." },
      { property: "og:title", content: "Abonnements — Pro Tailleur Online" },
      { property: "og:description", content: "Simple, Pro ou Gold avec Essai gratuit — 1 mois (100 clients et 100 commandes max), sans paiement maintenant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PageShell><Pricing /></PageShell>,
});
