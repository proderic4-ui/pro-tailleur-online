import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { authError, emailSchema, signupSchema } from "@/lib/auth-validation";
import { PLAN_CONFIGS, SELECTABLE_PLAN_LIST, type SelectablePlanId } from "@/lib/plans";
import { useAuthSession } from "./AuthSession";
import { PageShell, btn } from "./ui";

export function AuthCard({ mode, initialPlan = "pro" }: { mode: "login" | "signup"; initialPlan?: SelectablePlanId }) {
  const signup = mode === "signup";
  const navigate = useNavigate();
  const { user, ready } = useAuthSession();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forgot, setForgot] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<SelectablePlanId>(initialPlan);

  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  useEffect(() => {
    if (ready && user?.email_confirmed_at && !window.location.hash.includes("type=recovery")) void navigate({ to: "/tableau-de-bord", replace: true });
  }, [user, ready, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const email = emailSchema.safeParse(values['email']);
    if (!email.success) { setError(email.error.issues[0]?.message ?? "Adresse e-mail invalide."); return; }
    setBusy(true);
    try {
      if (forgot) {
        const result = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${window.location.origin}/reset-password` });
        if (result.error) throw result.error;
        setNotice("Si un compte existe pour cette adresse, un lien de récupération vous sera envoyé. Vérifiez aussi vos courriers indésirables.");
      } else if (signup) {
        const parsed = signupSchema.safeParse({ ...values, plan: selectedPlan });
        if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Vérifiez les champs."); return; }
        const { full_name, workshop_name, phone, password, plan } = parsed.data;
        const result = await supabase.auth.signUp({
          email: email.data,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name, workshop_name, phone, plan },
          },
        });
        if (result.error) throw result.error;
        if (result.data.session) await navigate({ to: "/tableau-de-bord" });
        else setConfirmationEmail(email.data);
      } else {
        const password = typeof values['password'] === "string" ? values['password'] : "";
        if (!password || password.length > 128) { setError("Saisissez votre mot de passe."); return; }
        const result = await supabase.auth.signInWithPassword({ email: email.data, password });
        if (result.error) throw result.error;
        await navigate({ to: "/tableau-de-bord", replace: true });
      }
    } catch (err) { setError(authError(err instanceof Error ? err.message : "")); }
    finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setError("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: confirmationEmail, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setNotice("Un nouveau lien de confirmation a été demandé.");
    } catch (err) { setError(authError(err instanceof Error ? err.message : "")); }
    finally { setBusy(false); }
  }

  const chosen = PLAN_CONFIGS[selectedPlan];
  const field = "mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
    <PageShell>
      <section className={`mx-auto px-4 py-16 ${signup ? "max-w-lg" : "max-w-md"}`}>
        <div className="rounded-2xl border bg-card p-6 shadow-elegant sm:p-8">
          <h1 className="text-3xl text-primary">{confirmationEmail ? "Vérifiez votre e-mail" : forgot ? "Mot de passe oublié" : signup ? "Créer un compte" : "Se connecter"}</h1>
          {confirmationEmail ? <div className="mt-6 space-y-4"><MailCheck className="text-gold"/><p className="break-words text-sm text-muted-foreground">Consultez {confirmationEmail} et cliquez sur le lien de confirmation pour activer votre compte. Vérifiez aussi les courriers indésirables.</p><Button disabled={busy} variant="outline" className="w-full" onClick={resend}>Renvoyer le lien</Button><Link to="/connexion" className={`${btn.primary} w-full`}>Se connecter</Link></div> : <form className="mt-6 space-y-4" onSubmit={submit}>
            {signup && <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-primary">Formule choisie (1 mois d’essai gratuit)</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {SELECTABLE_PLAN_LIST.map((p) => {
                    const active = selectedPlan === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlan(p.id as SelectablePlanId)}
                        aria-pressed={active}
                        className={`relative rounded-xl border p-3 text-left text-xs transition-colors ${
                          active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"
                        }`}
                      >
                        {p.recommended && (
                          <span className="mb-1 inline-block rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-primary">
                            Recommandé
                          </span>
                        )}
                        <p className="font-semibold">{p.name}</p>
                        <p className="mt-0.5 opacity-85">{p.priceLabel} {p.period}</p>
                        <p className="mt-0.5 opacity-75">{p.clientLimit} clients max</p>
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-xl border border-gold/40 bg-gold-soft p-3 text-xs leading-relaxed text-primary">
                  <p className="font-semibold">1 mois d’essai gratuit — aucun paiement maintenant</p>
                  <p className="mt-1 text-muted-foreground">
                    Votre essai d’un mois calendaire (fuseau Africa/Lome) sur la formule {chosen.name} commence à la création du compte. Aucune carte bancaire ni renouvellement automatique. Sans paiement confirmé à l’échéance, le compte revient aux plafonds gratuits (10 clients, 5 commandes) sans perte de données.
                  </p>
                </div>
              </fieldset>
              <label className="block text-sm font-medium">Nom complet du tailleur<input name="full_name" autoComplete="name" required maxLength={100} className={field} /></label>
              <label className="block text-sm font-medium">Nom de l’atelier<input name="workshop_name" autoComplete="organization" required maxLength={120} className={field} /></label>
              <label className="block text-sm font-medium">Numéro de téléphone<input name="phone" aria-label="Numéro de téléphone" type="tel" autoComplete="tel" required defaultValue="+228" maxLength={20} className={field} /><span className="mt-1 block text-xs text-muted-foreground">+228 suivi de 8 chiffres</span></label>
            </>}
            <label className="block text-sm font-medium">Adresse e-mail<input name="email" type="email" autoComplete="email" required maxLength={255} className={field} /></label>
            {!forgot && <>
              <label className="block text-sm font-medium">Mot de passe<div className="relative"><input name="password" aria-label="Mot de passe" type={visible ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : 1} maxLength={128} className={`${field} pr-12`} /><Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2" aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</Button></div>{signup && <span className="mt-1 block text-xs text-muted-foreground">8 caractères minimum</span>}</label>
              {signup && <label className="block text-sm font-medium">Confirmation du mot de passe<input name="confirmation" type={visible ? "text" : "password"} autoComplete="new-password" required maxLength={128} className={field} /></label>}
            </>}
            <Button disabled={busy} className={`${btn.primary} w-full h-auto`}>
              {busy ? "Veuillez patienter…" : forgot ? "Envoyer le lien" : signup ? `Démarrer l’essai ${chosen.name}` : "Connexion"}
            </Button>
            {!signup && <Button type="button" variant="link" className="h-auto w-full whitespace-normal" onClick={() => { setForgot(!forgot); setError(""); setNotice(""); }}>{forgot ? "Revenir à la connexion" : "Mot de passe oublié ?"}</Button>}
          </form>}
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="mt-4 text-sm text-primary">{notice}</p>}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {signup ? "Déjà inscrit ? " : "Pas encore de compte ? "}
            <Link to={signup ? "/connexion" : "/inscription"} className="font-semibold text-primary underline">
              {signup ? "Se connecter" : "Créer un compte"}
            </Link>
          </p>
        </div>
      </section>
    </PageShell>
  );
}
