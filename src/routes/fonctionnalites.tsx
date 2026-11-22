import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/ui";
import { Features } from "@/components/site/sections";

export const Route = createFileRoute("/fonctionnalites")({
  head: () => ({
    meta: [
      { title: "Fonctionnalités — Pro Tailleur Online" },
      { name: "description", content: "Clients, mesures, commandes, photos privées, acomptes saisis manuellement et alertes de livraison pour votre atelier." },
      { property: "og:title", content: "Fonctionnalités — Pro Tailleur Online" },
      { property: "og:description", content: "Les outils disponibles pour gérer votre atelier de couture." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PageShell><Features /></PageShell>,
});
