import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PageShell, btn } from "@/components/site/ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { authError, passwordSchema } from "@/lib/auth-validation";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Réinitialiser mon mot de passe — Pro Tailleur Online" },
    { name: "description", content: "Choisissez un nouveau mot de passe pour votre atelier." },
    { property: "og:title", content: "Réinitialiser mon mot de passe — Pro Tailleur Online" },
    { property: "og:description", content: "Récupération sécurisée de votre compte tailleur." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }), component: ResetPassword,
});
function ResetPassword() {
  const [valid, setValid] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    const recovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery" || sessionStorage.getItem("tailor-recovery") === "true";
    if (recovery) sessionStorage.setItem("tailor-recovery", "true");
    void supabase.auth.getUser().then(({ data }) => { if (alive) setValid(recovery && !!data.user); });
    return () => { alive = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const values = new FormData(event.currentTarget);
    const parsed = passwordSchema.safeParse(values.get("password"));
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Mot de passe invalide."); return; }
    if (parsed.data !== values.get("confirmation")) { setError("Les mots de passe ne correspondent pas."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data });
      if (error) throw error;
      sessionStorage.removeItem("tailor-recovery"); setDone(true);
    } catch (err) { setError(authError(err instanceof Error ? err.message : "")); }
    finally { setBusy(false); }
  }
  const field = "mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  return <PageShell><section className="mx-auto max-w-md px-4 py-16"><div className="rounded-2xl border bg-card p-8 shadow-elegant"><h1 className="text-3xl text-primary">Nouveau mot de passe</h1>
    {done ? <><p role="status" className="mt-6 text-primary">Votre mot de passe a été modifié.</p><Link to="/tableau-de-bord" className={`${btn.primary} mt-6 w-full`}>Mon atelier</Link></> : valid === null ? <p role="status" className="mt-6">Vérification du lien…</p> : !valid ? <><p role="alert" className="mt-6 text-sm text-muted-foreground">Ce lien est invalide ou a expiré. Demandez un nouveau lien depuis la connexion.</p><Link to="/connexion" className={`${btn.primary} mt-6 w-full`}>Se connecter</Link></> : <form className="mt-6 space-y-4" onSubmit={submit}><label className="block text-sm font-medium">Mot de passe<div className="relative"><input name="password" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128} className={`${field} pr-12`} /><Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2" aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff/> : <Eye/>}</Button></div></label><label className="block text-sm font-medium">Confirmation du mot de passe<input name="confirmation" type={visible ? "text" : "password"} autoComplete="new-password" required maxLength={128} className={field}/></label><Button disabled={busy} className={`${btn.primary} h-auto w-full`}>{busy ? "Veuillez patienter…" : "Enregistrer"}</Button></form>}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  </div></section></PageShell>;
}