import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/site/AuthCard";

export const Route = createFileRoute("/inscription")({
  head: () => ({
    meta: [
      { title: "Créer un compte — Pro Tailleur Online" },
      { name: "description", content: "Inscrivez votre atelier sur Pro Tailleur Online." },
      { property: "og:title", content: "Créer un compte — Pro Tailleur Online" },
      { property: "og:description", content: "Inscrivez votre atelier gratuitement." },
    ],
  }),
  component: () => <AuthCard mode="signup" />,
});
