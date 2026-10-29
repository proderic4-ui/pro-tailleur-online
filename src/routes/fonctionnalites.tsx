import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/ui";
import { Features } from "@/components/site/sections";

export const Route = createFileRoute("/fonctionnalites")({
  head: () => ({
    meta: [
      { title: "Fonctionnalités — Pro Tailleur Online" },
      { name: "description", content: "Clients, mesures, commandes, paiements, dépenses, statistiques et notifications pour votre atelier." },
      { property: "og:title", content: "Fonctionnalités — Pro Tailleur Online" },
      { property: "og:description", content: "Tous les outils pour gérer votre atelier de couture." },
    ],
  }),
  component: () => <PageShell><Features /></PageShell>,
});
