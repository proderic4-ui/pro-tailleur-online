import { Link } from "@tanstack/react-router";
import { Users, Ruler, ClipboardList, Wallet, Receipt, BarChart3, Bell, Check, Clock, CheckCircle2, AlertTriangle, HandCoins } from "lucide-react";
import { btn, SectionTitle } from "./ui";

const features = [
  { icon: Users, title: "Gestion des clients", text: "Un carnet clair avec contacts et historique de chaque client." },
  { icon: Ruler, title: "Prise de mesures", text: "Enregistrez toutes les mesures, fini les cahiers perdus." },
  { icon: ClipboardList, title: "Gestion des commandes", text: "Suivez chaque tenue, du tissu à la livraison." },
  { icon: Wallet, title: "Suivi des paiements", text: "Avances, soldes et reliquats toujours à jour." },
  { icon: Receipt, title: "Gestion des dépenses", text: "Tissus, fils, loyer : maîtrisez vos sorties d'argent." },
  { icon: BarChart3, title: "Statistiques et bilans", text: "Comprenez la santé de votre atelier en un coup d'œil." },
  { icon: Bell, title: "Notifications", text: "Rappels des livraisons et des paiements à venir." },
];

export function Features() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow="Fonctionnalités" title="Tout votre atelier, dans votre poche" sub="Des outils pensés pour les tailleurs et couturiers africains." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

const plans = [
  { name: "Gratuit", price: "0", period: "FCFA", perks: ["5 clients maximum", "3 commandes maximum", "Prise de mesures"], cta: "Commencer gratuitement", featured: false },
  { name: "Mensuel", price: "2 000", period: "FCFA / mois", perks: ["Clients illimités", "Commandes illimitées", "Paiements et dépenses", "Statistiques"], cta: "Choisir Mensuel", featured: false },
  { name: "Annuel", price: "15 000", period: "FCFA / an", perks: ["Tout le plan Mensuel", "Bilans annuels", "Notifications", "Économie de 9 000 FCFA"], cta: "Choisir Annuel", featured: true },
];

export function Pricing() {
  return (
    <section className="bg-secondary py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow="Abonnements" title="Des tarifs simples et accessibles" sub="Paiement en ligne bientôt disponible." />
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={`relative flex flex-col rounded-2xl p-8 ${p.featured ? "bg-primary text-primary-foreground shadow-elegant" : "border bg-card"}`}>
              {p.featured && <span className="absolute -top-3 left-8 rounded-full bg-gold px-3 py-1 text-xs font-bold text-primary">Le plus avantageux</span>}
              <h3 className="font-sans text-lg font-bold">{p.name}</h3>
              <p className="mt-4"><span className="font-display text-4xl">{p.price}</span> <span className="text-sm opacity-70">{p.period}</span></p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {p.perks.map((k) => (
                  <li key={k} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-gold" />{k}</li>
                ))}
              </ul>
              <Link to="/inscription" className={`mt-8 ${p.featured ? btn.gold : btn.primary}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const stats = [
  { icon: Users, label: "Clients" },
  { icon: Clock, label: "Commandes en cours" },
  { icon: CheckCircle2, label: "Commandes terminées" },
  { icon: AlertTriangle, label: "Commandes en retard" },
  { icon: Wallet, label: "Paiements reçus", money: true },
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
      <p className="mt-4 text-center text-xs text-muted-foreground">Vos chiffres s'afficheront ici une fois votre atelier configuré.</p>
    </div>
  );
}
