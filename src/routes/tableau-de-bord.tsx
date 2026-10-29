import { createFileRoute } from "@tanstack/react-router";
import { PageShell, SectionTitle } from "@/components/site/ui";
import { DashboardMock } from "@/components/site/sections";

export const Route = createFileRoute("/tableau-de-bord")({
  head: () => ({
    meta: [
      { title: "Tableau de bord (aperçu) — Pro Tailleur Online" },
      { name: "description", content: "Aperçu du tableau de bord tailleur : clients, commandes, paiements et soldes." },
      { property: "og:title", content: "Tableau de bord — Pro Tailleur Online" },
      { property: "og:description", content: "Maquette du tableau de bord pour tailleurs." },
    ],
  }),
  component: () => (
    <PageShell>
      <section className="mx-auto max-w-5xl px-4 py-16">
        <SectionTitle eyebrow="Maquette" title="Tableau de bord du tailleur" sub="Aperçu visuel — aucune donnée réelle pour le moment." />
        <DashboardMock />
      </section>
    </PageShell>
  ),
});
