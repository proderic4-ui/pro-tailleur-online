import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/site/AuthCard";

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [
      { title: "Se connecter — Pro Tailleur Online" },
      { name: "description", content: "Connectez-vous à votre atelier Pro Tailleur Online." },
      { property: "og:title", content: "Se connecter — Pro Tailleur Online" },
      { property: "og:description", content: "Accédez à votre atelier." },
    ],
  }),
  component: () => <AuthCard mode="login" />,
});
