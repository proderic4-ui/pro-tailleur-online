import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { PageShell } from "@/components/site/ui";
import { ClientsError } from "@/components/site/ClientsError";
import { orderQuery } from "@/lib/orders.queries";
import { updateOrderStatus } from "@/lib/orders.functions";
import { ORDER_STATUSES, deliveryAlert, fcfa, type OrderStatus } from "@/lib/garments";

function OrderNotFound() {
  return <PageShell><section className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-3xl text-primary">Commande inaccessible</h1><p className="mt-4 text-muted-foreground">Cette commande n’existe pas ou n’appartient pas à votre atelier.</p><Link to="/commandes" search={{ statut: "all" }} className="mt-6 inline-block text-primary underline">Retour aux commandes</Link></section></PageShell>;
}
export const Route = createFileRoute("/_authenticated/commandes/$orderId")({
  loader: async ({ params, context }) => {
    if (!z.string().uuid().safeParse(params.orderId).success) throw notFound();
    if (!(await context.queryClient.ensureQueryData(orderQuery(params.orderId)))) throw notFound();
  },
  head: () => ({ meta: [
    { title: "Détail de commande — Pro Tailleur Online" },
    { name: "description", content: "Mesures, photos, prix et statut d’une commande de votre atelier." },
    { property: "og:title", content: "Détail de commande — Pro Tailleur Online" },
    { property: "og:description", content: "Une commande privée de votre atelier." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  errorComponent: ClientsError, notFoundComponent: OrderNotFound,
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderQuery(orderId));
  const queryClient = useQueryClient();
  const update = useServerFn(updateOrderStatus);
  const [msg, setMsg] = useState("");
  if (!order) return <OrderNotFound />;
  const client = order.client as { id: string; full_name: string; phone: string | null } | null;
  const measurements = (order.measurements ?? []) as { label: string; value: number; unit: string }[];
  const alert = deliveryAlert(order);
  async function changeStatus(status: OrderStatus) {
    setMsg("");
    const r = await update({ data: { id: orderId, status } });
    setMsg(r.error ?? "Statut mis à jour.");
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["order", orderId] }), queryClient.invalidateQueries({ queryKey: ["orders"] }), queryClient.invalidateQueries({ queryKey: ["client-history"] })]);
  }
  const Item = ({ k, v }: { k: string; v: string }) => <div><dt className="text-sm text-muted-foreground">{k}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-primary">{v || "—"}</dd></div>;
  return <PageShell><section className="mx-auto max-w-3xl px-4 py-10">
    <Link to="/commandes" search={{ statut: "all" }} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Retour aux commandes</Link>
    <h1 className="break-words text-3xl text-primary md:text-4xl">Commande N° {order.order_number} · {order.garment_type}</h1>
    {client && <p className="mt-2 text-muted-foreground">Client : <Link to="/clients/$clientId" params={{ clientId: client.id }} className="text-primary underline">{client.full_name}</Link></p>}
    {alert && <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${alert === "late" ? "text-destructive" : "text-gold"}`}><AlertTriangle className="h-4 w-4" />{alert === "late" ? "Date de livraison dépassée" : "Livraison dans les 3 jours"}</p>}
    <label className="mt-6 block max-w-sm space-y-2 text-sm font-medium"><span>Statut</span><select aria-label="Statut" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={order.status} onChange={(e) => changeStatus(e.target.value as OrderStatus)}>{ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
    {msg && <p role="status" className="mt-2 text-sm text-muted-foreground">{msg}</p>}
    <dl className="mt-8 grid gap-6 border-y py-6 sm:grid-cols-3">
      <Item k="Prix total" v={fcfa(order.total_price)} /><Item k="Acompte (saisi manuellement)" v={fcfa(order.deposit)} /><Item k="Solde restant" v={fcfa(order.balance ?? 0)} />
      <Item k="Créée le" v={new Date(order.created_at).toLocaleDateString("fr-FR")} /><Item k="Livraison prévue" v={order.delivery_date ? new Date(order.delivery_date + "T00:00:00").toLocaleDateString("fr-FR") : ""} />
    </dl>
    <dl className="grid gap-6 border-b py-6 sm:grid-cols-2"><Item k="Description" v={order.description} /><Item k="Couleurs" v={order.colors} /><Item k="Finitions" v={order.finishes} /><Item k="Notes" v={order.notes} /></dl>
    <section className="border-b py-6"><h2 className="text-xl text-primary">Mesures utilisées</h2>{measurements.length ? <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{measurements.map((m, i) => <div key={i}><dt className="text-sm text-muted-foreground">{m.label}</dt><dd className="font-semibold text-primary">{m.value} {m.unit}</dd></div>)}</dl> : <p className="mt-2 text-sm text-muted-foreground">Aucune mesure saisie.</p>}</section>
    <section className="py-6"><h2 className="text-xl text-primary">Photos</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{([["model", "Modèle"], ["fabric", "Tissu ou pagne"]] as const).map(([k, label]) => <figure key={k}><figcaption className="mb-2 text-sm text-muted-foreground">{label}</figcaption>{order.photoUrls[k] ? <img src={order.photoUrls[k]!} alt={label} className="aspect-square w-full rounded-md border object-cover" /> : <p className="text-sm text-muted-foreground">Aucune photo</p>}</figure>)}</div></section>
  </section></PageShell>;
}
