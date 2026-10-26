import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/site/AuthCard";
export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Accès à mon atelier — Pro Tailleur Online" },
    { name: "description", content: "Connectez-vous pour accéder à votre atelier privé." },
    { property: "og:title", content: "Accès à mon atelier — Pro Tailleur Online" },
    { property: "og:description", content: "Connexion à votre espace tailleur sécurisé." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <AuthCard mode="login" />,
});