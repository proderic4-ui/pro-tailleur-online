import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, ClipboardList, ChevronRight, AlertTriangle, Clock } from "lucide-react";
import { z } from "zod";
import { PageShell } from "@/components/site/ui";
import { Button } from "@/components/ui/button";
import { ClientsError } from "@/components/site/ClientsError";
import { ordersQuery } from "@/lib/orders.queries";
import { FREE_ORDER_MESSAGE, ORDER_STATUSES, deliveryAlert, fcfa, statusLabel } from "@/lib/garments";

const filters = ["all", "alert", ...ORDER_STATUSES.map((s) => s.value)] as const;
export const Route = createFileRoute("/_authenticated/commandes/")({
  validateSearch: (search) => ({ statut: z.enum(filters).catch("all").parse(search["statut"] ?? "all") }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQuery),
  head: () => ({ meta: [
    { title: "Commandes — Pro Tailleur Online" },
    { name: "description", content: "Suivez les commandes de votre atelier, leurs statuts et dates de livraison." },
    { property: "og:title", content: "Commandes — Pro Tailleur Online" },
    { property: "og:description", content: "Le suivi privé des commandes de votre atelier." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  errorComponent: ClientsError,
  component: Orders,
});

function Orders() {
  const { data } = useSuspenseQuery(ordersQuery);
  const { statut } = Route.useSearch();
  const navigate = Route.useNavigate();
  const atLimit = data.limit !== null && data.orders.length >= data.limit;
  const alerts = data.orders.filter((o) => deliveryAlert(o));
  const orders = data.orders.filter((o) => statut === "all" ? true : statut === "alert" ? deliveryAlert(o) : o.status === statut);
  const chip = (value: (typeof filters)[number], label: string) => <button key={value} type="button" onClick={() => navigate({ search: { statut: value }, replace: true })} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${statut === value ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}>{label}</button>;
  return <PageShell><section className="mx-auto max-w-5xl px-4 py-10 md:py-12">
    <p className="mb-2 break-words text-sm font-medium text-muted-foreground">{data.workshop.name}</p>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl text-primary md:text-4xl">Commandes</h1><p className="mt-2 text-sm text-muted-foreground">{data.orders.length} commande{data.orders.length !== 1 ? "s" : ""}{data.limit !== null ? ` · ${data.limit} maximum` : " · illimitées"}</p></div>
      {atLimit ? <Button disabled className="rounded-full"><Plus className="h-4 w-4" />Nouvelle commande</Button> : <Button asChild className="rounded-full"><Link to="/commandes/nouvelle"><Plus className="h-4 w-4" />Nouvelle commande</Link></Button>}</div>
    {atLimit && <div role="alert" className="mt-6 border-l-4 border-gold bg-gold-soft p-4 text-sm leading-relaxed text-primary"><p>{FREE_ORDER_MESSAGE}</p><Link to="/tarifs" className="mt-2 inline-block font-semibold underline">Voir les abonnements</Link></div>}
    {alerts.length > 0 && <p className="mt-6 flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{alerts.length} commande{alerts.length > 1 ? "s" : ""} en retard ou à livrer dans les 3 jours.</p>}
    <div className="mt-6 flex gap-2 overflow-x-auto pb-2">{chip("all", "Toutes")}{chip("alert", "À surveiller")}{ORDER_STATUSES.map((s) => chip(s.value, s.label))}</div>
    {orders.length === 0 ? <div className="py-16 text-center"><ClipboardList className="mx-auto h-10 w-10 text-gold" /><h2 className="mt-4 text-xl text-primary">{data.orders.length ? "Aucune commande pour ce filtre" : "Aucune commande enregistrée"}</h2></div> : <div className="mt-4">
      {orders.map((o) => { const alert = deliveryAlert(o); const client = o.client as { full_name: string } | null; return <Link key={o.id} to="/commandes/$orderId" params={{ orderId: o.id }} className="flex items-center gap-3 border-b py-4 hover:bg-muted/60">
        <div className="min-w-0 flex-1"><p className="break-words font-semibold text-primary">N° {o.order_number} · {o.garment_type}</p><p className="break-words text-sm text-muted-foreground">{client?.full_name ?? "Client"} · {statusLabel(o.status)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground"><span>Livraison : {o.delivery_date ? new Date(o.delivery_date + "T00:00:00").toLocaleDateString("fr-FR") : "—"}</span><span>Solde : {fcfa(o.balance ?? 0)}</span>{alert && <span className={`inline-flex items-center gap-1 font-semibold ${alert === "late" ? "text-destructive" : "text-gold"}`}>{alert === "late" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{alert === "late" ? "En retard" : "Livraison proche"}</span>}</p></div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>; })}
    </div>}
  </section></PageShell>;
}
