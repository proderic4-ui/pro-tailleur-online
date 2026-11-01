import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X, Scissors, LayoutDashboard, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "./AuthSession";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

const btnBase =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold transition-colors";
export const btn = {
  primary: `${btnBase} bg-primary text-primary-foreground hover:bg-primary/90`,
  gold: `${btnBase} bg-gold text-primary hover:bg-gold/90`,
  outline: `${btnBase} border border-primary/20 text-primary hover:bg-secondary`,
  ghostLight: `${btnBase} border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10`,
};

// Below this width there is no room for the full menu on one line, so the hamburger takes over.
// The class names must stay literal (min-[1100px]:flex / min-[1100px]:hidden) so Tailwind generates them.

const nav = [
  { to: "/", label: "Accueil" },
  { to: "/fonctionnalites", label: "Fonctionnalités" },
  { to: "/tarifs", label: "Abonnements" },
  { to: "/tableau-de-bord", label: "Tableau de bord" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-gold">
        <Scissors className="h-4 w-4" />
      </span>
      <span className="whitespace-nowrap font-display text-xl text-primary">
        Pro Tailleur <span className="text-gold">Online</span>
      </span>
    </Link>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, ready } = useAuthSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [signoutError, setSignoutError] = useState("");
  async function signOut() {
    setSigningOut(true); setSignoutError("");
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) { setSignoutError("Déconnexion impossible. Réessayez."); setSigningOut(false); return; }
    setOpen(false);
    await navigate({ to: "/auth", replace: true });
    setSigningOut(false);
  }
  const account = user ? <><Link to="/tableau-de-bord" onClick={() => setOpen(false)} className={btn.outline}>Mon atelier</Link><Button disabled={signingOut} onClick={signOut} className={`${btn.primary} h-auto`}>Déconnexion</Button></> : ready ? <><Link to="/connexion" onClick={() => setOpen(false)} className={btn.outline}>Se connecter</Link><Link to="/inscription" onClick={() => setOpen(false)} className={btn.primary}>Créer un compte</Link></> : null;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl flex-nowrap items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="hidden shrink-0 gap-6 min-[1100px]:flex">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="whitespace-nowrap text-sm font-medium text-muted-foreground hover:text-primary" activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-2 min-[1100px]:flex">
          {account}
        </div>
        <Button variant="ghost" size="icon" className="text-primary min-[1100px]:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <div className="border-t px-4 py-4 min-[1100px]:hidden">
          <div className="flex flex-col gap-3">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="whitespace-nowrap font-medium text-primary">{n.label}</Link>
            ))}
            {account}
          </div>
        </div>
      )}
      {user && <nav aria-label="Mon atelier" className="border-t bg-background"><div className="mx-auto flex max-w-6xl items-center gap-6 px-4"><Link to="/tableau-de-bord" className="inline-flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-muted-foreground" activeProps={{ className: "border-gold text-primary" }}><LayoutDashboard className="h-4 w-4" />Tableau de bord</Link><Link to="/clients" search={{ q: "" }} className="inline-flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-muted-foreground" activeProps={{ className: "border-gold text-primary" }}><Users className="h-4 w-4" />Clients</Link></div></nav>}
      {signoutError && <p role="alert" className="px-4 py-2 text-sm text-destructive">{signoutError}</p>}
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
