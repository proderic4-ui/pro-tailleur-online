import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/ui";
import { Pricing } from "@/components/site/sections";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Abonnements — Pro Tailleur Online" },
      { name: "description", content: "Gratuit, Mensuel 2 000 FCFA ou Annuel 15 000 FCFA." },
      { property: "og:title", content: "Abonnements — Pro Tailleur Online" },
      { property: "og:description", content: "Des tarifs simples pour les ateliers de couture." },
    ],
  }),
  component: () => <PageShell><Pricing /></PageShell>,
});
