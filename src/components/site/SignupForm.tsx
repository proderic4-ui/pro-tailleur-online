import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, MailCheck, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  authError,
  combineFullName,
  namePartSchema,
  OTHER_COUNTRY_OPTION,
  resolveCountrySelection,
  resolveFinalCountry,
  selectablePlanSchema,
  SIGNUP_COUNTRIES,
  signupSchema,
} from "@/lib/auth-validation";
import { PLAN_CONFIGS, SELECTABLE_PLAN_LIST, type SelectablePlanId } from "@/lib/plans";
import { useAuthSession } from "./AuthSession";
import { PageShell, btn } from "./ui";

export type SignupInitialValues = {
  workshop_name?: string;
  workshop_address?: string;
  workshop_city?: string;
  workshop_country?: string;
  workshop_phone?: string;
  workshop_email?: string;
  workshop_description?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
};

export function SignupForm({
  initialPlan,
  initialValues,
}: {
  initialPlan?: SelectablePlanId | undefined;
  initialValues?: SignupInitialValues | undefined;
}) {
  const navigate = useNavigate();
  const { user, ready } = useAuthSession();
  const planSectionRef = useRef<HTMLElement | null>(null);

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");

  const [selectedPlan, setSelectedPlan] = useState<SelectablePlanId | null>(initialPlan ?? null);
  const [editingPlan, setEditingPlan] = useState(!initialPlan);

  const initialCountryState = resolveCountrySelection(initialValues?.workshop_country);
  const [countryOption, setCountryOption] = useState<string>(initialCountryState.selectedCountry);
  const [customCountry, setCustomCountry] = useState<string>(initialCountryState.customCountry);

  useEffect(() => {
    const nextCountryState = resolveCountrySelection(initialValues?.workshop_country);
    setCountryOption(nextCountryState.selectedCountry);
    setCustomCountry(nextCountryState.customCountry);
  }, [initialValues?.workshop_country]);

  useEffect(() => {
    if (initialPlan) {
      setSelectedPlan(initialPlan);
      setEditingPlan(false);
    } else {
      setSelectedPlan(null);
      setEditingPlan(true);
    }
  }, [initialPlan]);

  useEffect(() => {
    if (ready && user?.email_confirmed_at && !window.location.hash.includes("type=recovery")) {
      void navigate({ to: "/tableau-de-bord", replace: true });
    }
  }, [user, ready, navigate]);

  function handleCountryChange(nextValue: string) {
    setCountryOption(nextValue);
    if (nextValue !== OTHER_COUNTRY_OPTION) {
      setCustomCountry("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const values = Object.fromEntries(new FormData(event.currentTarget));
    const names = namePartSchema.safeParse({
      first_name: values["first_name"] ?? "",
      last_name: values["last_name"] ?? "",
    });
    if (!names.success) {
      setError(names.error.issues[0]?.message ?? "Vérifiez le prénom et le nom du responsable.");
      return;
    }

    const planParsed = selectablePlanSchema.safeParse(selectedPlan);
    if (!planParsed.success) {
      setEditingPlan(true);
      setError(planParsed.error.issues[0]?.message ?? "Veuillez sélectionner une formule : Simple, Pro ou Gold.");
      planSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const full_name = combineFullName(names.data.first_name, names.data.last_name);
    const resolvedCountry = resolveFinalCountry(countryOption, customCountry);
    const parsed = signupSchema.safeParse({
      full_name,
      workshop_name: values["workshop_name"] ?? "",
      workshop_address: values["workshop_address"] ?? "",
      workshop_city: values["workshop_city"] ?? "",
      workshop_country: resolvedCountry,
      workshop_phone: values["workshop_phone"] ?? "",
      workshop_email: values["workshop_email"] ?? "",
      workshop_description: values["workshop_description"] ?? "",
      phone: values["phone"] ?? "",
      email: values["email"] ?? "",
      password: values["password"] ?? "",
      confirmation: values["confirmation"] ?? "",
      plan: planParsed.data,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Vérifiez les champs du formulaire.");
      return;
    }

    setBusy(true);
    try {
      const {
        full_name: validatedName,
        workshop_name,
        workshop_address,
        workshop_city,
        workshop_country,
        workshop_phone,
        workshop_email,
        workshop_description,
        phone,
        email,
        password,
        plan,
      } = parsed.data;
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: validatedName,
            workshop_name,
            workshop_address,
            workshop_city,
            workshop_country,
            workshop_phone,
            workshop_email,
            workshop_description,
            phone,
            plan,
          },
        },
      });
      if (result.error) throw result.error;
      if (result.data.session) await navigate({ to: "/tableau-de-bord" });
      else setConfirmationEmail(email);
    } catch (err) {
      setError(authError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError("");
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (resendError) throw resendError;
      setNotice("Un nouveau lien de confirmation a été demandé.");
    } catch (err) {
      setError(authError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  const chosen = selectedPlan ? PLAN_CONFIGS[selectedPlan] : null;
  const field =
    "mt-1.5 w-full min-w-0 min-h-11 rounded-xl border bg-background px-4 py-2.5 text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring sm:text-sm";

  return (
    <PageShell>
      <section className="bg-secondary/40 px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-gold">
                <Scissors className="h-4 w-4" />
              </span>
              <span className="font-display text-2xl text-primary">
                Pro Tailleur <span className="text-gold">Online</span>
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Votre atelier, plus proche de vous
            </p>
            <h1 className="mt-4 text-balance text-3xl text-primary sm:text-4xl">
              {confirmationEmail ? "Vérifiez votre adresse e-mail" : "Créer l’espace de votre atelier"}
            </h1>
            {!confirmationEmail && (
              <p className="mt-2 text-sm font-medium text-primary">
                Essai gratuit — 1 mois — aucun paiement demandé aujourd’hui
              </p>
            )}
          </div>

          {confirmationEmail ? (
            <div className="rounded-2xl border bg-card p-6 shadow-elegant sm:p-8">
              <div className="space-y-4">
                <MailCheck className="h-7 w-7 text-gold" />
                <p className="break-words text-sm leading-relaxed text-muted-foreground">
                  Consultez <strong className="text-primary">{confirmationEmail}</strong> et cliquez sur le lien de
                  confirmation pour activer votre compte. Vérifiez aussi les courriers indésirables.
                </p>
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <Button
                    disabled={busy}
                    variant="outline"
                    className="min-h-11 flex-1"
                    onClick={resend}
                  >
                    Renvoyer le lien
                  </Button>
                  <Link to="/connexion" className={`${btn.primary} min-h-11 flex-1`}>
                    Se connecter
                  </Link>
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                {notice && (
                  <p role="status" className="text-sm text-primary">
                    {notice}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={submit} noValidate>
              {/* Section 1: Atelier */}
              <section
                aria-labelledby="signup-workshop-heading"
                className="rounded-2xl border bg-card p-5 shadow-elegant sm:p-7"
              >
                <h2 id="signup-workshop-heading" className="font-display text-xl text-primary">
                  1. Informations de l’atelier
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Présentez votre atelier de couture. Les champs facultatifs peuvent rester vides.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block min-w-0 text-sm font-medium text-primary sm:col-span-2">
                    Nom de l’atelier <span className="text-destructive">*</span>
                    <input
                      name="workshop_name"
                      type="text"
                      autoComplete="organization"
                      required
                      defaultValue={initialValues?.workshop_name ?? ""}
                      maxLength={120}
                      placeholder="Ex. Atelier Élégance Lomé"
                      className={field}
                    />
                  </label>

                  <label className="block min-w-0 text-sm font-medium text-primary sm:col-span-2">
                    Adresse physique <span className="font-normal text-muted-foreground">(facultative)</span>
                    <input
                      name="workshop_address"
                      type="text"
                      autoComplete="street-address"
                      defaultValue={initialValues?.workshop_address ?? ""}
                      maxLength={300}
                      placeholder="Ex. Rue du Grand Marché, Quartier Tokoin"
                      className={field}
                    />
                  </label>

                  <label className="block min-w-0 text-sm font-medium text-primary">
                    Ville <span className="font-normal text-muted-foreground">(facultative)</span>
                    <input
                      name="workshop_city"
                      type="text"
                      autoComplete="address-level2"
                      defaultValue={initialValues?.workshop_city ?? ""}
                      maxLength={100}
                      placeholder="Ex. Lomé"
                      className={field}
                    />
                  </label>

                  <label className="block min-w-0 text-sm font-medium text-primary">
                    Pays <span className="text-destructive">*</span>
                    <select
                      name="workshop_country_select"
                      aria-label="Pays"
                      value={countryOption}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className={field}
                    >
                      {SIGNUP_COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                      <option value={OTHER_COUNTRY_OPTION}>{OTHER_COUNTRY_OPTION}</option>
                    </select>
                  </label>

                  {countryOption === OTHER_COUNTRY_OPTION && (
                    <label className="block min-w-0 text-sm font-medium text-primary sm:col-span-2">
                      Nom du pays <span className="text-destructive">*</span>
                      <input
                        name="custom_country"
                        type="text"
                        required
                        value={customCountry}
                        onChange={(e) => setCustomCountry(e.target.value)}
                        maxLength={100}
                        placeholder="Saisissez le nom de votre pays"
                        className={field}
                      />
                    </label>
                  )}

                  <label className="block min-w-0 text-sm font-medium text-primary">
                    Téléphone de l’atelier <span className="font-normal text-muted-foreground">(facultatif)</span>
                    <input
                      name="workshop_phone"
                      aria-label="Téléphone de l’atelier"
                      type="tel"
                      inputMode="tel"
                      defaultValue={initialValues?.workshop_phone ?? ""}
                      maxLength={30}
                      placeholder="Ex. +228 90 00 00 00"
                      className={field}
                    />
                    <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                      Tout indicatif international accepté (8 à 15 chiffres)
                    </span>
                  </label>

                  <label className="block min-w-0 text-sm font-medium text-primary">
                    Adresse e-mail de l’atelier <span className="font-normal text-muted-foreground">(facultative)</span>
                    <input
                      name="workshop_email"
                      aria-label="Adresse e-mail de l’atelier"
                      type="email"
                      defaultValue={initialValues?.workshop_email ?? ""}
                      maxLength={255}
                      placeholder="contact@monatelier.com"
                      className={field}
                    />
                    <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                      Distincte de votre e-mail de connexion personnel
                    </span>
                  </label>

                  <label className="block min-w-0 text-sm font-medium text-primary sm:col-span-2">
                    Description de l’atelier <span className="font-normal text-muted-foreground">(facultative)</span>
                    <textarea
                      name="workshop_description"
                      rows={3}
                      defaultValue={initialValues?.workshop_description ?? ""}
                      maxLength={2000}
                      placeholder="Ex. Tenues traditionnelles, costumes sur mesure et retouches"
                      className={`${field} min-h-[88px] py-2.5`}
                    />
                  </label>
                </div>
              </section>

              {/* Section 2: Responsable */}
              <section
                aria-labelledby="signup-owner-heading"
                className="rounded-2xl border bg-card p-5 shadow-elegant sm:p-7"
              >
                <h2 id="signup-owner-heading" className="font-display text-xl text-primary">
                  2. Responsable de l’atelier
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ces informations créent votre profil privé et vos identifiants de connexion.
                </p>
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block min-w-0 text-sm font-medium text-primary">
                      Prénom <span className="text-destructive">*</span>
                      <input
                        name="first_name"
                        type="text"
                        autoComplete="given-name"
                        required
                        defaultValue={initialValues?.first_name ?? ""}
                        maxLength={50}
                        placeholder="Ex. Koffi"
                        className={field}
                      />
                    </label>
                    <label className="block min-w-0 text-sm font-medium text-primary">
                      Nom <span className="text-destructive">*</span>
                      <input
                        name="last_name"
                        type="text"
                        autoComplete="family-name"
                        required
                        defaultValue={initialValues?.last_name ?? ""}
                        maxLength={50}
                        placeholder="Ex. Mensah"
                        className={field}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block min-w-0 text-sm font-medium text-primary">
                      Numéro de téléphone <span className="text-destructive">*</span>
                      <input
                        name="phone"
                        aria-label="Numéro de téléphone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        defaultValue={initialValues?.phone ?? "+228"}
                        maxLength={20}
                        placeholder="+228 90 12 34 56"
                        className={field}
                      />
                      <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                        +228 suivi de 8 chiffres
                      </span>
                    </label>

                    <label className="block min-w-0 text-sm font-medium text-primary">
                      Email de connexion <span className="text-destructive">*</span>
                      <input
                        name="email"
                        aria-label="Email de connexion"
                        type="email"
                        autoComplete="email"
                        required
                        defaultValue={initialValues?.email ?? ""}
                        maxLength={255}
                        placeholder="vous@exemple.com"
                        className={field}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block min-w-0 text-sm font-medium text-primary">
                      Mot de passe <span className="text-destructive">*</span>
                      <div className="relative">
                        <input
                          name="password"
                          aria-label="Mot de passe"
                          type={visible ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          minLength={8}
                          maxLength={128}
                          className={`${field} pr-12`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1.5 top-2 h-10 w-10"
                          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                          title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                          onClick={() => setVisible(!visible)}
                        >
                          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                        8 caractères minimum
                      </span>
                    </label>

                    <label className="block min-w-0 text-sm font-medium text-primary">
                      Confirmer le mot de passe <span className="text-destructive">*</span>
                      <input
                        name="confirmation"
                        type={visible ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={128}
                        className={field}
                      />
                    </label>
                  </div>
                </div>
              </section>

              {/* Section 3: Formule */}
              <section
                ref={planSectionRef}
                aria-labelledby="signup-plan-heading"
                className="rounded-2xl border bg-card p-5 shadow-elegant sm:p-7"
              >
                <h2 id="signup-plan-heading" className="font-display text-xl text-primary">
                  3. Formule choisie
                </h2>

                {chosen && !editingPlan ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary p-5 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gold">
                          Formule sélectionnée{chosen.recommended ? " · Recommandée" : ""}
                        </p>
                        <p className="mt-1 font-display text-2xl">
                          {chosen.name} —{" "}
                          <span className="tabular-nums">
                            {chosen.priceLabel} {chosen.period}
                          </span>
                        </p>
                        <p className="mt-1.5 text-xs text-primary-foreground/85 tabular-nums">
                          Essai gratuit — 1 mois : 100 clients et 100 commandes max · Abonnement payant : jusqu’à {chosen.clientLimit} clients et commandes illimitées
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 shrink-0 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                        onClick={() => setEditingPlan(true)}
                      >
                        Modifier la formule
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">
                        Sélectionnez votre formule : <strong className="text-primary">Simple</strong>,{" "}
                        <strong className="text-primary">Pro</strong> ou <strong className="text-primary">Gold</strong>.
                      </p>
                      {chosen && (
                        <button
                          type="button"
                          onClick={() => setEditingPlan(false)}
                          className="text-xs font-semibold text-primary underline hover:text-primary/80"
                        >
                          Fermer le sélecteur
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {SELECTABLE_PLAN_LIST.map((p) => {
                        const active = selectedPlan === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPlan(p.id as SelectablePlanId);
                              setError("");
                            }}
                            aria-pressed={active}
                            className={`flex min-h-[44px] flex-col justify-between rounded-xl border p-4 text-left transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:bg-secondary"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-display text-lg">{p.name}</span>
                                {active ? (
                                  <Check className="h-4 w-4 shrink-0 text-gold" />
                                ) : p.recommended ? (
                                  <span className="text-xs font-semibold text-gold">Recommandé</span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-lg font-bold tabular-nums">
                                {p.priceLabel}{" "}
                                <span className="text-xs font-normal opacity-80">{p.period}</span>
                              </p>
                            </div>
                            <p className="mt-3 border-t border-current/15 pt-2.5 text-xs opacity-85 tabular-nums">
                              {p.clientLimit} clients max · Commandes illimitées
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-xl bg-gold-soft p-4 text-xs leading-relaxed text-primary">
                  <p className="font-semibold">Essai gratuit — 1 mois — aucun paiement demandé aujourd’hui</p>
                  <p className="mt-1 text-muted-foreground">
                    Votre accès d’essai d’un mois calendaire (fuseau Africa/Lome) démarre à l’activation du compte avec un maximum de 100 clients et 100 commandes enregistrés au total. Aucune carte bancaire ni prélèvement automatique. À la fin du mois sans paiement confirmé, les fonctions de gestion passent en lecture seule (vos données restent conservées, sans second essai gratuit) jusqu’à l’activation de Simple, Pro ou Gold.
                  </p>
                </div>
              </section>

              {error && (
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-xl border border-primary/20 bg-card px-4 py-3 text-sm text-primary">
                  {notice}
                </p>
              )}

              <div className="space-y-4">
                <Button disabled={busy} className={`${btn.primary} h-auto min-h-12 w-full text-base sm:text-sm`}>
                  {busy
                    ? "Création de votre atelier…"
                    : chosen
                      ? `Démarrer l’essai ${chosen.name}`
                      : "Créer mon atelier"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Déjà inscrit ?{" "}
                  <Link to="/connexion" className="font-semibold text-primary underline">
                    Se connecter
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </section>
    </PageShell>
  );
}
