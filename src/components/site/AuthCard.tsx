import { Link } from "@tanstack/react-router";
import { PageShell, btn } from "./ui";

export function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const field = "mt-1 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
    <PageShell>
      <section className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border bg-card p-8 shadow-elegant">
          <h1 className="text-3xl text-primary">{signup ? "Créer un compte" : "Se connecter"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Les comptes seront disponibles très bientôt.</p>
          <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
            {signup && <label className="block text-sm font-medium">Nom de l'atelier<input className={field} /></label>}
            <label className="block text-sm font-medium">Téléphone ou e-mail<input className={field} /></label>
            <label className="block text-sm font-medium">Mot de passe<input type="password" className={field} /></label>
            <button disabled className={`${btn.primary} w-full opacity-60`}>{signup ? "Créer mon compte" : "Connexion"} (bientôt)</button>
          </form>
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
