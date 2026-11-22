import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({ options }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("@/components/site/AuthSession", () => ({
  useAuthSession: () => ({ user: null, ready: true }),
}));

vi.mock("@/components/site/ui", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SectionTitle: ({ title }: { title: string }) => <h2>{title}</h2>,
  btn: {
    primary: "btn-primary",
    gold: "btn-gold",
    outline: "btn-outline",
    ghostLight: "btn-ghost-light",
  },
}));

import { Route as IndexRoute } from "@/routes/index";

describe("Page d'accueil — bouton WhatsApp", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche le bouton d'assistance WhatsApp vers https://wa.me/22899221591 sans message automatique", () => {
    const HomePage = IndexRoute.options.component as ComponentType;
    render(<HomePage />);

    const link = screen.getByRole("link", { name: /Assistance WhatsApp.*\+228 99 22 15 91/i });
    expect(link).toHaveAttribute("href", "https://wa.me/22899221591");
    expect(link.getAttribute("href")).not.toContain("text=");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
