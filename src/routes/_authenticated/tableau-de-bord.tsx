import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Scissors, Users, ClipboardList, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/site/ui";
import { Button } from "@/components/ui/button";
import { getMyWorkshop } from "@/lib/workshop.functions";

export const Route = createFileRoute("/_authenticated/tableau-de-bord")({
  head: () => ({ meta: [
    { title: "Mon atelier — Pro Tailleur Online" },
    { name: "description", content: "Votre espace personnel Pro Tailleur Online : atelier, clients et commandes." },
    { property: "og:title", content: "Mon atelier — Pro Tailleur Online" },
    { property: "og:description", content: "L’espace privé de votre atelier de couture." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const fetchWorkshop = useServerFn(getMyWorkshop);
  const query = useQuery({ queryKey: ["my-workshop"], queryFn: () => fetchWorkshop() });
  return <PageShell><section className="mx-auto max-w-5xl px-4 py-12">
    {query.isPending ? <p role="status" className="text-muted-foreground">Chargement de votre atelier…</p> : query.isError ? <div role="alert"><p className="text-destructive">Votre atelier n’a pas pu être chargé.</p><Button className="mt-4" onClick={() => query.refetch()}>Réessayer</Button></div> : <>
      <div className="flex items-center gap-3 text-gold"><Scissors /><p className="text-sm font-semibold">Mon atelier</p></div>
      <h1 className="mt-3 break-words text-3xl text-primary md:text-4xl">{query.data.workshop.name}</h1>
      <p className="mt-3 text-muted-foreground">Bienvenue, {query.data.profile?.full_name}.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[{ name: "Clients", value: query.data.clients, limit: query.data.clientLimit, Icon: Users }, { name: "Commandes", value: query.data.orders, limit: query.data.orderLimit, Icon: ClipboardList }].map(({ name, value, limit, Icon }) => <div key={name} className="rounded-lg border bg-card p-6"><Icon className="mb-4 text-gold" /><h2 className="text-lg text-primary">{name}</h2><p className="mt-2 text-3xl font-semibold text-primary">{value} <span className="text-sm font-normal text-muted-foreground">{limit === null ? "· illimités" : `/ ${limit}`}</span></p></div>)}
      </div>
      <div className="mt-8 border-t pt-6"><div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5"/><h2 className="text-xl">Formule {query.data.clientLimit !== null ? "Gratuite" : query.data.subscription?.plan === "annual" ? "Annuelle" : "Mensuelle"}</h2></div><p className="mt-2 text-sm text-muted-foreground">{query.data.clientLimit !== null ? "5 clients maximum · 3 commandes maximum" : "Clients et commandes illimités"}</p><p className="mt-4 break-all text-xs text-muted-foreground">Identifiant de l’atelier : {query.data.workshop.id}</p></div>
    </>}
  </section></PageShell>;
}