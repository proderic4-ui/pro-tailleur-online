import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageShell } from "./ui";
export function ClientsError() {
  const router = useRouter();
  return <PageShell><section className="mx-auto max-w-5xl px-4 py-12"><h1 className="text-3xl text-primary">Chargement impossible</h1><p role="alert" className="mt-4 text-muted-foreground">Les informations n’ont pas pu être chargées.</p><Button className="mt-6" onClick={() => router.invalidate()}>Réessayer</Button></section></PageShell>;
}
export function ClientNotFound() {
  return <PageShell><section className="mx-auto max-w-5xl px-4 py-12"><h1 className="text-3xl text-primary">Client inaccessible</h1><p className="mt-4 text-muted-foreground">Cette fiche n’existe pas ou n’appartient pas à votre atelier.</p><Link to="/clients" className="mt-6 inline-block text-primary underline">Retour aux clients</Link></section></PageShell>;
}