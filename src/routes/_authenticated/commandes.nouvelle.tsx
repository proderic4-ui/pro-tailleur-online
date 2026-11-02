import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { PageShell } from "@/components/site/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClientsError } from "@/components/site/ClientsError";
import { supabase } from "@/integrations/supabase/client";
import { orderFormQuery } from "@/lib/orders.queries";
import { addGarmentCategory, createOrder } from "@/lib/orders.functions";
import { GARMENT_TYPES, balance, fcfa, orderSchema } from "@/lib/garments";

export const Route = createFileRoute("/_authenticated/commandes/nouvelle")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orderFormQuery),
  head: () => ({ meta: [
    { title: "Nouvelle commande — Pro Tailleur Online" },
    { name: "description", content: "Créez une commande : client, vêtement, photos, mesures, livraison et acompte." },
    { property: "og:title", content: "Nouvelle commande — Pro Tailleur Online" },
    { property: "og:description", content: "Enregistrez une nouvelle commande pour votre atelier." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  errorComponent: ClientsError,
  component: NewOrder,
});

type Row = { label: string; value: string };
const Step = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => <fieldset className="border-b py-6"><legend className="mb-4 flex items-center gap-3 text-lg text-primary"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-gold">{n}</span>{title}</legend><div className="space-y-4">{children}</div></fieldset>;
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="block space-y-2 text-sm font-medium"><span>{label}</span>{children}</label>;
const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function NewOrder() {
  const { data } = useSuspenseQuery(orderFormQuery);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useServerFn(createOrder);
  const addCategory = useServerFn(addGarmentCategory);
  const [clientId, setClientId] = useState("");
  const [garment, setGarment] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [photos, setPhotos] = useState<{ model: File | null; fabric: File | null }>({ model: null, fabric: null });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newCat, setNewCat] = useState({ open: false, name: "", labels: "", error: "" });

  const types = useMemo(() => ({ ...GARMENT_TYPES, ...Object.fromEntries(data.categories.map((c) => [c.name, c.measurement_labels])) }) as Record<string, string[]>, [data.categories]);
  function chooseGarment(name: string, client = clientId) {
    setGarment(name);
    const previous = data.measurements.find((m) => m.client_id === client && m.garment_type === name)?.measurements as { label: string; value: number }[] | undefined;
    setRows((types[name] ?? []).map((label) => ({ label, value: String(previous?.find((p) => p.label === label)?.value ?? "") })).concat((previous ?? []).filter((p) => !(types[name] ?? []).includes(p.label)).map((p) => ({ label: p.label, value: String(p.value) }))));
  }
  async function saveCategory() {
    const labels = newCat.labels.split(",").map((s) => s.trim()).filter(Boolean);
    const r = await addCategory({ data: { name: newCat.name.trim(), measurement_labels: labels } });
    if (r.error || !r.category) { setNewCat({ ...newCat, error: r.error ?? "Erreur." }); return; }
    await queryClient.invalidateQueries({ queryKey: ["order-form"] });
    setNewCat({ open: false, name: "", labels: "", error: "" });
    setGarment(r.category.name); setRows(r.category.measurement_labels.map((label) => ({ label, value: "" })));
  }
  async function upload(file: File | null) {
    if (!file) return null;
    if (!file.type.startsWith("image/")) throw new Error("Seules les images sont acceptées.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Chaque photo doit faire moins de 5 Mo.");
    const path = `${data.workshopId}/${crypto.randomUUID()}.${(file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"}`;
    const { error } = await supabase.storage.from("order-photos").upload(path, file, { contentType: file.type });
    if (error) throw new Error("La photo n’a pas pu être envoyée. Réessayez.");
    return path;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const f = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const filled = rows.filter((r) => r.label.trim() && r.value.trim());
    const candidate = { client_id: clientId, garment_type: garment, description: f["description"] ?? "", colors: f["colors"] ?? "", finishes: f["finishes"] ?? "", notes: f["notes"] ?? "", delivery_date: f["delivery_date"] ?? "", total_price: Number(total || "x"), deposit: Number(deposit || 0), measurements: filled.map((r) => ({ label: r.label.trim(), value: Number(r.value.replace(",", ".")), unit: "cm" as const })), model_photo_path: null, fabric_photo_path: null };
    const parsed = orderSchema.safeParse(candidate);
    if (!parsed.success) { setError(Number.isNaN(candidate.total_price) ? "Indiquez le prix total." : parsed.error.issues[0]?.message ?? "Vérifiez les informations."); return; }
    setSaving(true);
    try {
      const [model, fabric] = await Promise.all([upload(photos.model), upload(photos.fabric)]);
      const r = await create({ data: { ...parsed.data, model_photo_path: model, fabric_photo_path: fabric } });
      if (r.error || !r.id) { setError(r.error ?? "Enregistrement impossible."); return; }
      await Promise.all(["orders", "order-form", "my-workshop", "client-history"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      await navigate({ to: "/commandes/$orderId", params: { orderId: r.id } });
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setSaving(false); }
  }
  const remaining = balance(Number(total) || 0, Number(deposit) || 0);

  return <PageShell><section className="mx-auto max-w-3xl px-4 py-10">
    <Link to="/commandes" search={{ statut: "all" }} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Retour aux commandes</Link>
    <h1 className="text-3xl text-primary md:text-4xl">Nouvelle commande</h1>
    {data.clients.length === 0 ? <p className="mt-6 text-muted-foreground">Enregistrez d’abord un client. <Link to="/clients" search={{ q: "" }} className="text-primary underline">Aller aux clients</Link></p> :
    <form onSubmit={submit} className="mt-4">
      <Step n={1} title="Client"><Field label="Client *"><select aria-label="Client" className={selectCls} value={clientId} onChange={(e) => { setClientId(e.target.value); if (garment) chooseGarment(garment, e.target.value); }} required><option value="">Choisir un client</option>{data.clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` · ${c.phone}` : ""}</option>)}</select></Field></Step>
      <Step n={2} title="Type de vêtement">
        <Field label="Vêtement *"><select aria-label="Type de vêtement" className={selectCls} value={garment} onChange={(e) => chooseGarment(e.target.value)} required><option value="">Choisir un type</option>{Object.keys(types).map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
        {newCat.open ? <div className="space-y-3 rounded-md border p-4"><Field label="Nom du modèle ou de la catégorie"><Input maxLength={60} value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} /></Field><Field label="Mesures (séparées par des virgules)"><Input value={newCat.labels} placeholder="Poitrine, Taille, Longueur" onChange={(e) => setNewCat({ ...newCat, labels: e.target.value })} /></Field>{newCat.error && <p role="alert" className="text-sm text-destructive">{newCat.error}</p>}<div className="flex gap-2"><Button type="button" size="sm" onClick={saveCategory}>Ajouter le modèle</Button><Button type="button" size="sm" variant="ghost" onClick={() => setNewCat({ open: false, name: "", labels: "", error: "" })}>Annuler</Button></div></div> : <Button type="button" variant="outline" size="sm" onClick={() => setNewCat({ ...newCat, open: true })}><Plus className="h-4 w-4" />Ajouter mon propre modèle</Button>}
      </Step>
      <Step n={3} title="Photos (facultatives)">
        <Field label="Photo du modèle"><Input type="file" accept="image/*" onChange={(e) => setPhotos({ ...photos, model: e.target.files?.[0] ?? null })} /></Field>
        <Field label="Photo du tissu ou pagne"><Input type="file" accept="image/*" onChange={(e) => setPhotos({ ...photos, fabric: e.target.files?.[0] ?? null })} /></Field>
        <p className="text-xs text-muted-foreground">Images de 5 Mo maximum, visibles uniquement par votre atelier.</p>
      </Step>
      <Step n={4} title="Description"><Field label="Description du modèle"><Textarea name="description" maxLength={2000} rows={3} /></Field><Field label="Couleurs"><Input name="colors" maxLength={300} /></Field><Field label="Finitions"><Textarea name="finishes" maxLength={1000} rows={2} /></Field></Step>
      <Step n={5} title="Mesures (cm)">
        {!garment ? <p className="text-sm text-muted-foreground">Choisissez d’abord un type de vêtement.</p> : <>
          {rows.map((r, i) => <div key={i} className="flex items-end gap-2"><div className="min-w-0 flex-1">{(types[garment] ?? []).includes(r.label) ? <p className="pb-2 text-sm font-medium">{r.label}</p> : <Input aria-label="Nom de la mesure" placeholder="Nom de la mesure" maxLength={60} value={r.label} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />}</div><Input aria-label={`${r.label || "Mesure"} en cm`} className="w-24" inputMode="decimal" placeholder="cm" value={r.value} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} /><Button type="button" variant="ghost" size="icon" aria-label="Retirer la mesure" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>)}
          <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { label: "", value: "" }])}><Plus className="h-4 w-4" />Ajouter une mesure personnalisée</Button>
        </>}
      </Step>
      <Step n={6} title="Livraison et prix">
        <Field label="Date de livraison prévue *"><Input name="delivery_date" type="date" required /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Prix total (FCFA) *"><Input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} required /></Field><Field label="Acompte reçu (FCFA)"><Input inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/\D/g, ""))} /></Field></div>
        <p className="text-sm">Solde restant : <strong className={remaining < 0 ? "text-destructive" : "text-primary"}>{fcfa(remaining)}</strong></p>
        <p className="text-xs text-muted-foreground">L’acompte est une information saisie manuellement, pas un paiement en ligne.</p>
        <Field label="Notes"><Textarea name="notes" maxLength={2000} rows={2} /></Field>
      </Step>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-6 flex justify-end"><Button type="submit" disabled={saving} className="rounded-full">{saving ? "Enregistrement…" : "Enregistrer la commande"}</Button></div>
    </form>}
  </section></PageShell>;
}
