import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Users, ChevronRight, Phone } from "lucide-react";
import { z } from "zod";
import { PageShell } from "@/components/site/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientForm } from "@/components/site/ClientForm";
import { ClientsError, ClientNotFound } from "@/components/site/ClientsError";
import { clientsQuery } from "@/lib/clients.queries";
import { FREE_CLIENT_MESSAGE, matchesClient } from "@/lib/client-validation";

export const Route = createFileRoute("/_authenticated/clients/")({
  validateSearch: (search) => ({ q: z.string().max(100).catch("").parse(search.q ?? "") }),
  loader: ({ context }) => context.queryClient.ensureQueryData(clientsQuery),
  head: () => ({ meta: [
    { title: "Mes clients — Pro Tailleur Online" },
    { name: "description", content: "Retrouvez les clients de votre atelier et leurs coordonnées." },
    { property: "og:title", content: "Mes clients — Pro Tailleur Online" },
    { property: "og:description", content: "Votre carnet de clients privé." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  errorComponent: ClientsError, notFoundComponent: ClientNotFound,
  component: Clients,
});
function Clients() {
  const { data } = useSuspenseQuery(clientsQuery);
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState(false);
  const atLimit = data.limit !== null && data.clients.length >= data.limit;
  const clients = data.clients.filter((client) => matchesClient(client, q));
  return <PageShell><section className="mx-auto max-w-5xl px-4 py-10 md:py-12">
    <p className="mb-2 break-words text-sm font-medium text-muted-foreground">{data.workshop.name}</p>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl text-primary md:text-4xl">Clients</h1><p className="mt-2 text-sm text-muted-foreground">{data.clients.length} client{data.clients.length !== 1 ? "s" : ""}{data.limit !== null ? ` · ${data.limit} maximum` : " · illimités"}</p></div><Button onClick={() => setOpen(true)} disabled={atLimit} className="rounded-full"><Plus className="h-4 w-4" />Nouveau client</Button></div>
    {atLimit && <div role="alert" className="mt-6 border-l-4 border-gold bg-gold-soft p-4 text-sm leading-relaxed text-primary"><p>{FREE_CLIENT_MESSAGE}</p><Link to="/tarifs" className="mt-2 inline-block font-semibold underline">Voir les abonnements</Link></div>}
    <div className="relative mt-8 max-w-lg"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Rechercher un client" type="search" maxLength={100} value={q} placeholder="Rechercher par nom ou téléphone" className="pl-10" onChange={(event) => { void navigate({ search: { q: event.target.value }, replace: true }); }} /></div>
    {clients.length === 0 ? <div className="py-16 text-center"><Users className="mx-auto h-10 w-10 text-gold" /><h2 className="mt-4 text-xl text-primary">{q ? "Aucun client trouvé" : "Aucun client enregistré"}</h2>{q && <Button variant="ghost" className="mt-3" onClick={() => navigate({ search: { q: "" }, replace: true })}>Effacer la recherche</Button>}</div> : <div className="mt-6">
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_24px] gap-4 border-b py-3 text-xs font-semibold uppercase text-muted-foreground sm:grid"><span>Nom complet</span><span>Téléphone</span><span>Enregistré le</span><span /></div>
      {clients.map((client) => <Link key={client.id} to="/clients/$clientId" params={{ clientId: client.id }} className="grid grid-cols-[minmax(0,1fr)_24px] items-center gap-2 border-b py-5 transition-colors hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_24px] sm:gap-4">
        <span className="break-words font-semibold text-primary">{client.full_name}</span><ChevronRight className="row-span-3 h-4 w-4 text-muted-foreground sm:col-start-4 sm:row-span-1" /><span className="col-start-1 flex items-center gap-2 break-all text-sm text-muted-foreground sm:col-start-2 sm:row-start-1"><Phone className="h-3.5 w-3.5 shrink-0 sm:hidden" />{client.phone || "Non renseigné"}</span><span className="col-start-1 text-xs text-muted-foreground sm:col-start-3 sm:row-start-1 sm:text-sm">{new Date(client.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
      </Link>)}
    </div>}
    <ClientForm open={open} onOpenChange={setOpen} onSaved={(id) => { setOpen(false); void navigate({ to: "/clients/$clientId", params: { clientId: id } }); }} />
  </section></PageShell>;
}