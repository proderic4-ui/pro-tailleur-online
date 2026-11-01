import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clientSchema, type ClientInput } from "@/lib/client-validation";
import { createClient, updateClient } from "@/lib/clients.functions";

type ExistingClient = ClientInput & { id: string };
export function ClientForm({ open, onOpenChange, client, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; client?: ExistingClient; onSaved: (id: string) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg" aria-describedby={undefined}><DialogHeader><DialogTitle className="text-2xl tracking-normal text-primary">{client ? "Modifier le client" : "Nouveau client"}</DialogTitle></DialogHeader><Form key={client?.id ?? "new"} client={client} onCancel={() => onOpenChange(false)} onSaved={onSaved} /></DialogContent></Dialog>;
}
function Form({ client, onCancel, onSaved }: { client?: ExistingClient | undefined; onCancel: () => void; onSaved: (id: string) => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const create = useServerFn(createClient);
  const update = useServerFn(updateClient);
  const queryClient = useQueryClient();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = clientSchema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Vérifiez les informations."); return; }
    setSaving(true);
    try {
      const result = client ? await update({ data: { ...parsed.data, id: client.id } }) : await create({ data: parsed.data });
      if (result.error || !result.client) { setError(result.error ?? "Enregistrement impossible."); return; }
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["clients"] }), queryClient.invalidateQueries({ queryKey: ["my-workshop"] })]);
      queryClient.setQueryData(["client", result.client.id], result.client);
      onSaved(result.client.id);
    } catch { setError("Enregistrement impossible. Réessayez."); } finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <label className="block space-y-2 text-sm font-medium"> <span>Nom complet <span className="text-destructive">*</span></span><Input name="full_name" autoComplete="name" required maxLength={100} defaultValue={client?.full_name} autoFocus /></label>
    <label className="block space-y-2 text-sm font-medium"><span>Numéro de téléphone <span className="text-destructive">*</span></span><Input name="phone" type="tel" autoComplete="tel" required maxLength={30} placeholder="+228 90 12 34 56" defaultValue={client?.phone} /></label>
    <label className="block space-y-2 text-sm font-medium"><span>Adresse <span className="font-normal text-muted-foreground">(facultative)</span></span><Input name="address" autoComplete="street-address" maxLength={300} defaultValue={client?.address} /></label>
    <label className="block space-y-2 text-sm font-medium"><span>Notes particulières <span className="font-normal text-muted-foreground">(facultatives)</span></span><Textarea name="notes" maxLength={2000} rows={4} defaultValue={client?.notes} /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></div>
  </form>;
}