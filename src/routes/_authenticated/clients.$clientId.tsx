import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Pencil, Phone, MapPin, CalendarDays, FileText } from "lucide-react";
import { z } from "zod";
import { PageShell } from "@/components/site/ui";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/site/ClientForm";
import { ClientsError, ClientNotFound } from "@/components/site/ClientsError";
import { clientQuery } from "@/lib/clients.queries";
import { clientHistoryQuery } from "@/lib/orders.queries";
import { fcfa, statusLabel } from "@/lib/garments";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  loader: async ({ params, context }) => {
    if (!z.string().uuid().safeParse(params.clientId).success) throw notFound();
    const client = await context.queryClient.ensureQueryData(clientQuery(params.clientId));
    if (!client) throw notFound();
    await context.queryClient.ensureQueryData(clientHistoryQuery(params.clientId));
  },
  head: () => ({ meta: [
    { title: "Fiche client — Pro Tailleur Online" },
    { name: "description", content: "Informations et coordonnées d’un client de votre atelier." },
    { property: "og:title", content: "Fiche client — Pro Tailleur Online" },
    { property: "og:description", content: "Une fiche client privée et sécurisée." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  errorComponent: ClientsError, notFoundComponent: ClientNotFound,
  component: ClientDetail,
});
function ClientDetail() {
  const { clientId } = Route.useParams();
  const { data: client } = useSuspenseQuery(clientQuery(clientId));
  const { data: history } = useSuspenseQuery(clientHistoryQuery(clientId));
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!client) return <ClientNotFound />;
  return <PageShell><section className="mx-auto max-w-5xl px-4 py-10 md:py-12">
    <Link to="/clients" search={{ q: "" }} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Retour aux clients</Link>
    <div className="flex flex-wrap items-start justify-between gap-4"><h1 className="min-w-0 break-words text-3xl text-primary md:text-4xl">{client.full_name}</h1><Button variant="outline" className="shrink-0 rounded-full" onClick={() => { setSaved(false); setOpen(true); }}><Pencil className="h-4 w-4" />Modifier</Button></div>
    {saved && <p role="status" className="mt-4 text-sm text-success">Les informations du client ont été mises à jour.</p>}
    <dl className="mt-8 grid gap-x-8 gap-y-6 border-y py-8 sm:grid-cols-2">
      <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4 text-gold" />Numéro de téléphone</dt><dd className="mt-2 break-all text-primary">{client.phone || "Non renseigné"}</dd></div>
      <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4 text-gold" />Date d’enregistrement</dt><dd className="mt-2 text-primary">{new Date(client.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</dd></div>
      <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 text-gold" />Adresse</dt><dd className="mt-2 whitespace-pre-wrap break-words text-primary">{client.address || "Non renseignée"}</dd></div>
      <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4 text-gold" />Notes particulières</dt><dd className="mt-2 whitespace-pre-wrap break-words text-primary">{client.notes || "Aucune note"}</dd></div>
    </dl>
    <section className="border-b py-8"><h2 className="text-2xl text-primary">Historique des commandes</h2>{history.orders.length ? <ul className="mt-4 divide-y">{history.orders.map((o) => <li key={o.id}><Link to="/commandes/$orderId" params={{ orderId: o.id }} className="block py-3 hover:bg-muted/60"><span className="font-semibold text-primary">N° {o.order_number} · {o.garment_type}</span><span className="block text-sm text-muted-foreground">{statusLabel(o.status)} · Solde {fcfa(o.balance ?? 0)}</span></Link></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Aucune commande.</p>}</section>
    <section className="border-b py-8"><h2 className="text-2xl text-primary">Historique des mesures</h2>{history.measurements.length ? <ul className="mt-4 space-y-4">{history.measurements.map((m) => <li key={m.id}><p className="text-sm font-semibold text-primary">{new Date(m.taken_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} · {m.garment_type}</p><p className="text-sm text-muted-foreground">{(m.measurements as { label: string; value: number }[]).map((x) => `${x.label} : ${x.value} cm`).join(" · ")}</p></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Aucune mesure enregistrée.</p>}</section>
    <section className="py-8"><h2 className="text-2xl text-primary">Historique des paiements</h2><div className="min-h-16" /></section>
    <ClientForm open={open} onOpenChange={setOpen} client={{ ...client, phone: client.phone ?? "" }} onSaved={() => { setOpen(false); setSaved(true); }} />
  </section></PageShell>;
}