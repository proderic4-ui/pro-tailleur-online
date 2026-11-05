import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { PageShell } from "@/components/site/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClientsError } from "@/components/site/ClientsError";
import { supabase } from "@/integrations/supabase/client";
import { orderFormQuery, orderQuery } from "@/lib/orders.queries";
import { updateOrder } from "@/lib/orders.functions";
import { GARMENT_TYPES, balance, fcfa, orderUpdateSchema } from "@/lib/garments";

export const Route = createFileRoute("/_authenticated/commandes/$orderId_/modifier")({
  loader: async ({ params, context }) => {
    if (!z.string().uuid().safeParse(params.orderId).success) throw notFound();
    const [order] = await Promise.all([context.queryClient.ensureQueryData(orderQuery(params.orderId)), context.queryClient.ensureQueryData(orderFormQuery)]);
    if (!order) throw notFound();
  },
  head: () => ({ meta: [
    { title: "Modifier la commande — Pro Tailleur Online" },
    { name: "description", content: "Modifiez le vêtement, les mesures, la livraison, le prix et les photos d’une commande." },
    { property: "og:title", content: "Modifier la commande — Pro Tailleur Online" },
    { property: "og:description", content: "Modification d’une commande privée de votre atelier." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  errorComponent: ClientsError,
  notFoundComponent: () => <PageShell><section className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-3xl text-primary">Commande inaccessible</h1><p className="mt-4 text-muted-foreground">Cette commande n’existe pas ou n’appartient pas à votre atelier.</p></section></PageShell>,
  component: EditOrder,
});

type Row = { label: string; value: string };
const Step = ({ title, children }: { title: string; children: ReactNode }) => <fieldset className="border-b py-6"><legend className="mb-4 text-lg text-primary">{title}</legend><div className="space-y-4">{children}</div></fieldset>;
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="block space-y-2 text-sm font-medium"><span>{label}</span>{children}</label>;
const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function EditOrder() {
  const { orderId } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderQuery(orderId));
  const { data: form } = useSuspenseQuery(orderFormQuery);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const save = useServerFn(updateOrder);
  const o = order!;
  const types = useMemo(() => ({ ...GARMENT_TYPES, ...Object.fromEntries(form.categories.map((c) => [c.name, c.measurement_labels])) }) as Record<string, string[]>, [form.categories]);
  const [garment, setGarment] = useState(o.garment_type);
  const [rows, setRows] = useState<Row[]>(((o.measurements ?? []) as { label: string; value: number }[]).map((m) => ({ label: m.label, value: String(m.value) })));
  const [total, setTotal] = useState(String(o.total_price));
  const [deposit, setDeposit] = useState(String(o.deposit));
  const [photos, setPhotos] = useState<{ model: File | null; fabric: File | null }>({ model: null, fabric: null });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const client = o.client as { full_name: string } | null;
  const garmentOptions = types[garment] || garment in types ? Object.keys(types) : [garment, ...Object.keys(types)];

  function chooseGarment(name: string) {
    setGarment(name);
    const labels = types[name] ?? [];
    // Keep values already typed for matching labels, add the new type's labels.
    setRows(labels.map((label) => ({ label, value: rows.find((r) => r.label === label)?.value ?? "" })).concat(rows.filter((r) => !labels.includes(r.label) && r.value.trim())));
  }
  async function upload(file: File | null, existing: string | null) {
    if (!file) return existing; // keep existing photo unless replaced
    if (!file.type.startsWith("image/")) throw new Error("Seules les images sont acceptées.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Chaque photo doit faire moins de 5 Mo.");
    const path = `${o.workshop_id}/${crypto.randomUUID()}.${(file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"}`;
    const { error } = await supabase.storage.from("order-photos").upload(path, file, { contentType: file.type });
    if (error) throw new Error("La photo n’a pas pu être envoyée. Réessayez.");
    return path;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const f = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const filled = rows.filter((r) => r.label.trim() && r.value.trim());
    const candidate = { id: orderId, garment_type: garment, description: f["description"] ?? "", colors: f["colors"] ?? "", finishes: f["finishes"] ?? "", notes: f["notes"] ?? "", delivery_date: f["delivery_date"] ?? "", total_price: Number(total || "x"), deposit: Number(deposit || 0), measurements: filled.map((r) => ({ label: r.label.trim(), value: Number(r.value.replace(",", ".")), unit: "cm" as const })), model_photo_path: o.model_photo_path, fabric_photo_path: o.fabric_photo_path };
    const parsed = orderUpdateSchema.safeParse(candidate);
    if (!parsed.success) { setError(Number.isNaN(candidate.total_price) ? "Indiquez le prix total." : parsed.error.issues[0]?.message ?? "Vérifiez les informations."); return; }
    setSaving(true);
    try {
      const [model, fabric] = await Promise.all([upload(photos.model, o.model_photo_path), upload(photos.fabric, o.fabric_photo_path)]);
      const r = await save({ data: { ...parsed.data, model_photo_path: model, fabric_photo_path: fabric } });
      if (r.error) { setError(r.error); return; }
      await Promise.all(["order", "orders", "order-form", "client-history", "my-workshop"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      await navigate({ to: "/commandes/$orderId", params: { orderId } });
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setSaving(false); }
  }
  const remaining = balance(Number(total) || 0, Number(deposit) || 0);

  return <PageShell><section className="mx-auto max-w-3xl px-4 py-10">
    <Link to="/commandes/$orderId" params={{ orderId }} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Retour à la commande</Link>
    <h1 className="text-3xl text-primary md:text-4xl">Modifier la commande N° {o.order_number}</h1>
    <p className="mt-2 text-muted-foreground">Client : {client?.full_name ?? "—"} · créée le {new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
    <form onSubmit={submit} className="mt-4">
      <Step title="Type de vêtement"><Field label="Vêtement *"><select aria-label="Type de vêtement" className={selectCls} value={garment} onChange={(e) => chooseGarment(e.target.value)} required>{garmentOptions.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field></Step>
      <Step title="Photos">
        {([["model", "Photo du modèle"], ["fabric", "Photo du tissu ou pagne"]] as const).map(([k, label]) => <Field key={k} label={label}>
          {o.photoUrls[k] && <img src={o.photoUrls[k]!} alt={`${label} actuelle`} className="h-24 w-24 rounded-md border object-cover" />}
          <Input type="file" accept="image/*" aria-label={label} onChange={(e) => setPhotos({ ...photos, [k]: e.target.files?.[0] ?? null })} />
        </Field>)}
        <p className="text-xs text-muted-foreground">Sans nouveau fichier, la photo actuelle est conservée. 5 Mo maximum.</p>
      </Step>
      <Step title="Description"><Field label="Description du modèle"><Textarea name="description" maxLength={2000} rows={3} defaultValue={o.description} /></Field><Field label="Couleurs"><Input name="colors" maxLength={300} defaultValue={o.colors} /></Field><Field label="Finitions"><Textarea name="finishes" maxLength={1000} rows={2} defaultValue={o.finishes} /></Field></Step>
      <Step title="Mesures (cm)">
        {rows.map((r, i) => <div key={i} className="flex items-end gap-2"><div className="min-w-0 flex-1"><Input aria-label="Nom de la mesure" placeholder="Nom de la mesure" maxLength={60} value={r.label} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /></div><Input aria-label={`${r.label || "Mesure"} en cm`} className="w-24" inputMode="decimal" placeholder="cm" value={r.value} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} /><Button type="button" variant="ghost" size="icon" aria-label="Retirer la mesure" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>)}
        <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { label: "", value: "" }])}><Plus className="h-4 w-4" />Ajouter une mesure</Button>
      </Step>
      <Step title="Livraison et prix">
        <Field label="Date de livraison prévue *"><Input name="delivery_date" type="date" required defaultValue={o.delivery_date ?? ""} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Prix total (FCFA) *"><Input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} required /></Field><Field label="Acompte reçu (FCFA)"><Input inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/\D/g, ""))} /></Field></div>
        <p className="text-sm">Solde restant : <strong className={remaining < 0 ? "text-destructive" : "text-primary"}>{fcfa(remaining)}</strong></p>
        <p className="text-xs text-muted-foreground">L’acompte est une information saisie manuellement, pas un paiement en ligne.</p>
        <Field label="Notes"><Textarea name="notes" maxLength={2000} rows={2} defaultValue={o.notes} /></Field>
      </Step>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><Link to="/commandes/$orderId" params={{ orderId }} className="inline-flex items-center rounded-full px-4 text-sm text-muted-foreground hover:text-primary">Annuler</Link><Button type="submit" disabled={saving} className="rounded-full">{saving ? "Enregistrement…" : "Enregistrer les modifications"}</Button></div>
    </form>
  </section></PageShell>;
}
