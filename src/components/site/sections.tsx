import { Link } from "@tanstack/react-router";
import { Users, Ruler, ClipboardList, Wallet, BarChart3, Bell, Check, Clock, CheckCircle2, AlertTriangle, HandCoins, ShieldAlert } from "lucide-react";
import { btn, SectionTitle } from "./ui";
import { SELECTABLE_PLAN_LIST, type SelectablePlanId } from "@/lib/plans";
import { useAuthSession } from "./AuthSession";

const features = [
  { icon: Users, title: "Gestion des clients", text: "Un carnet clair avec téléphone, adresse, notes et historique de chaque client." },
  { icon: Ruler, title: "Prise de mesures", text: "Enregistrez vos mesures par vêtement et créez vos propres modèles." },
  { icon: ClipboardList, title: "Gestion des commandes", text: "Suivez chaque tenue du dépôt de tissu à la livraison, avec photos privées." },
  { icon: Wallet, title: "Acomptes saisis manuellement", text: "Saisissez le prix total et l’acompte reçu ; le solde restant est calculé automatiquement (pas de paiement en ligne)." },
  { icon: BarChart3, title: "Indicateurs de l’atelier", text: "Compteurs en temps réel des commandes en cours, prêtes, livrées et montants saisis." },
  { icon: Bell, title: "Alertes de livraison", text: "Repérez immédiatement les commandes en retard ou à livrer dans les 3 prochains jours." },
];

export function Features() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow="Fonctionnalités" title="Tout votre atelier, dans votre poche" sub="Des outils pensés pour les tailleurs et couturiers africains." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 transition-shadow hover:shadow-elegant">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-soft text-primary"><f.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-sans text-base font-bold text-primary">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function planPerks(clientLimit: number, memberLimit: number): string[] {
  return [
    `Abonnement payant : jusqu’à ${clientLimit} clients enregistrés`,
    "Abonnement payant : commandes illimitées",
    `Jusqu’à ${memberLimit} comptes de membres d’atelier, propriétaire compris (gestion multi-comptes à venir)`,
    "Mesures, modèles personnalisés et photos privées",
    "Saisie manuelle des acomptes et indicateurs d’atelier",
  ];
}

export function Pricing() {
  const { user, ready } = useAuthSession();
  const signedIn = ready && Boolean(user);

  return (
    <section className="bg-secondary py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Abonnements"
          title="Des formules adaptées à la taille de votre atelier"
          sub="Essai gratuit — 1 mois pour démarrer (100 clients et 100 commandes max), puis Simple, Pro ou Gold."
        />

        <div className="mb-10 rounded-2xl border border-gold/40 bg-gold-soft px-5 py-4 text-center text-sm text-primary">
          <p className="font-semibold">Essai gratuit — 1 mois — aucun paiement maintenant</p>
          <p className="mt-1 text-muted-foreground">
            Pendant cet accès temporaire d’un mois calendaire (fuseau Africa/Lome), vous pouvez enregistrer jusqu’à{" "}
            <strong className="text-primary">100 clients</strong> et <strong className="text-primary">100 commandes</strong>{" "}
            au total. À l’issue du mois sans paiement confirmé, vos données restent consultables en{" "}
            <strong className="text-primary">lecture seule</strong> (aucune suppression, aucun second essai gratuit) jusqu’à l’activation d’une formule payante.
          </p>
        </div>

        {signedIn && (
          <div role="status" className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-5 py-4 text-sm text-primary">
            <p>
              Vous êtes déjà inscrit : aucun deuxième essai gratuit n’est accordé lors du choix de Simple, Pro ou Gold. Le paiement en ligne n’est pas encore configuré ; aucun abonnement payant n’est activé sans confirmation réelle du paiement.
            </p>
            <Link to="/tableau-de-bord" className={btn.outline}>Voir mon atelier</Link>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {SELECTABLE_PLAN_LIST.map((p) => {
            const planId = p.id as SelectablePlanId;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl p-7 ${
                  p.recommended ? "bg-primary text-primary-foreground shadow-elegant" : "border bg-card"
                }`}
              >
                {p.recommended && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-1 text-xs font-bold text-primary">
                    Recommandé
                  </span>
                )}
                <h3 className="font-sans text-lg font-bold">{p.name}</h3>
                <p className="mt-4">
                  <span className="font-display text-4xl">{p.priceLabel}</span>{" "}
                  <span className="text-sm opacity-80">{p.period}</span>
                </p>
                <p className={`mt-2 text-xs font-medium ${p.recommended ? "text-gold" : "text-primary"}`}>
                  {signedIn
                    ? "Sans second essai gratuit · activation après paiement"
                    : "Essai gratuit — 1 mois (100 clients · 100 commandes max)"}
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {planPerks(p.clientLimit, p.memberLimit).map((k) => (
                    <li key={k} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
                {signedIn ? (
                  <Link to="/tableau-de-bord" className={`mt-8 ${p.recommended ? btn.gold : btn.primary}`}>
                    Paiement non configuré · Mon atelier
                  </Link>
                ) : (
                  <Link
                    to="/inscription"
                    search={{ formule: planId }}
                    className={`mt-8 ${p.recommended ? btn.gold : btn.primary}`}
                  >
                    Essai gratuit — 1 mois ({p.name})
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div className="space-y-2">
              <p className="font-semibold text-primary">Transparence sur les fonctionnalités disponibles</p>
              <p>
                Pendant l’Essai gratuit — 1 mois, le serveur et la base de données limitent l’atelier à 100 clients et 100 commandes enregistrés au total, puis basculent les fonctions de gestion en lecture seule à la date d’expiration. Après confirmation réelle d’un abonnement Simple (100 clients), Pro (200 clients) ou Gold (500 clients), ces plafonds clients s’appliquent sans limite de commandes.
              </p>
              <p>
                Fonctions non encore disponibles dans l’application actuelle : paiement en ligne pour activer automatiquement Simple, Pro ou Gold, gestion de plusieurs comptes membres d’atelier (seul le compte propriétaire est actif pour le moment), génération de factures/reçus, suivi des dépenses et statistiques détaillées.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const stats = [
  { icon: Users, label: "Clients" },
  { icon: Clock, label: "Commandes en cours" },
  { icon: CheckCircle2, label: "Commandes prêtes" },
  { icon: AlertTriangle, label: "Commandes en retard" },
  { icon: Wallet, label: "Acomptes saisis", money: true },
  { icon: HandCoins, label: "Soldes à recevoir", money: true },
];

export function DashboardMock() {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-elegant md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Aperçu</p>
          <p className="font-display text-xl text-primary">Mon atelier</p>
        </div>
        <span className="rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold text-primary">Maquette</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-background p-4">
            <s.icon className="h-5 w-5 text-gold" />
            <p className="mt-3 font-display text-2xl text-primary">{s.money ? "— FCFA" : "—"}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Vos chiffres s’afficheront ici une fois votre atelier configuré (acomptes saisis manuellement).</p>
    </div>
  );
}
