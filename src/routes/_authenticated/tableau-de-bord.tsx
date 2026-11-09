import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Scissors, Users, ClipboardList, ShieldCheck, Clock, PackageCheck, CheckCheck, AlertTriangle, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/site/ui";
import { ClientsError } from "@/components/site/ClientsError";
import { workshopQuery } from "@/lib/workshop.queries";
import { dashboardDate, type DashboardOrder } from "@/lib/dashboard";
import { fcfa } from "@/lib/garments";

export const Route = createFileRoute("/_authenticated/tableau-de-bord")({
  loader: ({ context }) => context.queryClient.ensureQueryData(workshopQuery),
  errorComponent: ClientsError,
  notFoundComponent: () => <PageShell><p className="px-4 py-12 text-center text-muted-foreground">Atelier introuvable.</p></PageShell>,
  head: () => ({ meta: [
    { title: "Mon atelier — Pro Tailleur Online" },
    { name: "description", content: "Les indicateurs réels de votre atelier : commandes, acomptes manuels, soldes et livraisons." },
    { property: "og:title", content: "Mon atelier — Pro Tailleur Online" },
    { property: "og:description", content: "Suivez les commandes et les livraisons de votre atelier de couture dans votre espace privé." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(workshopQuery);
  return <PageShell><section className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-3 text-gold"><Scissors /><p className="text-sm font-semibold">Mon atelier</p></div>
      <h1 className="mt-3 break-words text-3xl text-primary md:text-4xl">{data.workshop.name}</h1>
      <p className="mt-3 text-muted-foreground">Bienvenue, {data.profile?.full_name}.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[{ name: "Clients", value: data.clients, limit: data.clientLimit, Icon: Users }, { name: "Commandes", value: data.orders, limit: data.orderLimit, Icon: ClipboardList }].map(({ name, value, limit, Icon }) => <div key={name} className="rounded-lg border bg-card p-6"><Icon className="mb-4 text-gold" /><h2 className="text-lg text-primary">{name}</h2><p className="mt-2 text-3xl font-semibold text-primary">{value} <span className="text-sm font-normal text-muted-foreground">{limit === null ? "· illimités" : `/ ${limit}`}</span></p></div>)}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[{ name: "Commandes en cours", value: data.stats.inProgress, Icon: Clock }, { name: "Prêtes à récupérer", value: data.stats.ready, Icon: PackageCheck }, { name: "Livrées", value: data.stats.delivered, Icon: CheckCheck }, { name: "En retard", value: data.stats.late, Icon: AlertTriangle }].map(({ name, value, Icon }) => <div key={name} className="min-w-0 rounded-lg border bg-card p-4 sm:p-6"><Icon className="mb-3 h-5 w-5 text-gold"/><h2 className="min-h-12 break-words text-sm font-medium text-primary">{name}</h2><p className="mt-2 text-3xl font-semibold text-primary">{value}</p></div>)}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[{ name: "Total des acomptes saisis", value: data.stats.deposits }, { name: "Soldes restants · commandes non livrées", value: data.stats.remaining }].map(({ name, value }) => <div key={name} className="min-w-0 rounded-lg border bg-card p-6"><h2 className="text-sm font-medium text-muted-foreground">{name}</h2><p className="mt-3 break-words text-2xl font-semibold text-primary">{fcfa(value)}</p><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Montants saisis manuellement, pas de paiements en ligne.</p></div>)}
      </div>
      <DeliverySection title="Livraisons à venir" orders={data.stats.upcoming} empty="Aucune livraison prévue dans les 3 prochains jours." />
      <DeliverySection title="Commandes en retard" orders={data.stats.overdue} empty="Aucune commande en retard." />
      <div className="mt-8 border-t pt-6"><div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5"/><h2 className="text-xl">Formule {data.clientLimit !== null ? "Gratuite" : data.subscription?.plan === "annual" ? "Annuelle" : "Mensuelle"}</h2></div><p className="mt-2 text-sm text-muted-foreground">{data.clientLimit !== null ? "10 clients maximum · 3 commandes maximum" : "Clients et commandes illimités"}</p><p className="mt-4 break-all text-xs text-muted-foreground">Identifiant de l’atelier : {data.workshop.id}</p></div>
  </section></PageShell>;
}

function DeliverySection({ title, orders, empty }: { title: string; orders: DashboardOrder[]; empty: string }) {
  return <section className="mt-8 border-t pt-6" aria-label={title}>
    <h2 className="text-xl text-primary">{title}</h2>
    {orders.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{empty}</p> : <div className="mt-3">{orders.map((order) => <Link key={order.id} to="/commandes/$orderId" params={{ orderId: order.id }} className="flex items-center gap-3 border-b py-4 hover:bg-muted/60">
      <div className="min-w-0 flex-1"><p className="break-words font-semibold text-primary">N° {order.order_number} · {order.garment_type}</p><p className="mt-1 break-words text-sm text-muted-foreground">{order.client?.full_name ?? "Client"}</p><p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Livraison : {dashboardDate(order.delivery_date)}</span><span>Solde : {fcfa(order.balance)}</span></p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>)}</div>}
  </section>;
}