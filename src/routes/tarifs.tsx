import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/ui";
import { Pricing } from "@/components/site/sections";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Abonnements — Pro Tailleur Online" },
      { name: "description", content: "Gratuite 0 FCFA, Mensuelle 2 000 FCFA par mois ou Annuelle 15 000 FCFA par an." },
      { property: "og:title", content: "Abonnements — Pro Tailleur Online" },
      { property: "og:description", content: "Des tarifs simples pour les ateliers de couture." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PageShell><Pricing /></PageShell>,
});
