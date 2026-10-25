import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X, Scissors } from "lucide-react";

const btnBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors";
export const btn = {
  primary: `${btnBase} bg-primary text-primary-foreground hover:bg-primary/90`,
  gold: `${btnBase} bg-gold text-primary hover:bg-gold/90`,
  outline: `${btnBase} border border-primary/20 text-primary hover:bg-secondary`,
  ghostLight: `${btnBase} border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10`,
};

const nav = [
  { to: "/", label: "Accueil" },
  { to: "/fonctionnalites", label: "Fonctionnalités" },
  { to: "/tarifs", label: "Abonnements" },
  { to: "/tableau-de-bord", label: "Tableau de bord" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-gold">
        <Scissors className="h-4 w-4" />
      </span>
      <span className="font-display text-xl text-primary">
        Pro Tailleur <span className="text-gold">Online</span>
      </span>
    </Link>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden gap-6 md:flex">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="text-sm font-medium text-muted-foreground hover:text-primary" activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link to="/connexion" className={btn.outline}>Se connecter</Link>
          <Link to="/inscription" className={btn.primary}>Créer un compte</Link>
        </div>
        <button className="md:hidden text-primary" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="font-medium text-primary">{n.label}</Link>
            ))}
            <Link to="/connexion" onClick={() => setOpen(false)} className={btn.outline}>Se connecter</Link>
            <Link to="/inscription" onClick={() => setOpen(false)} className={btn.primary}>Créer un compte</Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-xl">Pro Tailleur <span className="text-gold">Online</span></p>
          <p className="text-sm opacity-70">Votre atelier, plus proche de vous.</p>
        </div>
        <p className="text-sm opacity-70">© {new Date().getFullYear()} Pro Tailleur Online · Lomé, Togo</p>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      <h2 className="mt-2 text-3xl text-primary md:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-muted-foreground">{sub}</p>}
    </div>
  );
}
