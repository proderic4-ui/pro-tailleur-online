import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero-atelier.jpg";
import { PageShell, btn, SectionTitle } from "@/components/site/ui";
import { Features, Pricing, DashboardMock } from "@/components/site/sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pro Tailleur Online — Votre atelier, plus proche de vous" },
      { name: "description", content: "La plateforme de gestion pour tailleurs et couturiers africains : clients, mesures, commandes, paiements." },
      { property: "og:title", content: "Pro Tailleur Online" },
      { property: "og:description", content: "Gérez votre atelier de couture simplement, depuis votre téléphone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <PageShell>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
        <div>
          <p className="inline-block rounded-full bg-gold-soft px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">Lancement au Togo</p>
          <h1 className="mt-5 text-4xl leading-tight text-primary md:text-6xl">
            Votre atelier, <span className="text-gold">plus proche</span> de vous.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Clients, mesures, commandes et paiements : gérez toute votre couture depuis votre téléphone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/inscription" className={btn.primary}>Commencer gratuitement</Link>
            <Link to="/connexion" className={btn.outline}>Se connecter</Link>
          </div>
        </div>
        <img src={hero} alt="Tailleur prenant des mesures sur un tissu wax" width={1280} height={1024} className="aspect-[5/4] w-full rounded-3xl object-cover shadow-elegant" />
      </section>
      <Features />
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <SectionTitle eyebrow="Tableau de bord" title="Votre atelier en un coup d'œil" />
          <DashboardMock />
        </div>
      </section>
      <Pricing />
      <section className="bg-primary py-16 text-center text-primary-foreground">
        <h2 className="text-3xl md:text-4xl">Prêt à moderniser votre atelier ?</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/inscription" className={btn.gold}>Créer un compte</Link>
          <Link to="/connexion" className={btn.ghostLight}>Se connecter</Link>
        </div>
      </section>
    </PageShell>
  );
}
