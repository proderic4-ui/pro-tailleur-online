import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const signUpMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => navigateMock,
}));

vi.mock("@/components/site/AuthSession", () => ({
  useAuthSession: () => ({ user: null, ready: true }),
}));

vi.mock("@/components/site/ui", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  btn: {
    primary: "btn-primary",
    gold: "btn-gold",
    outline: "btn-outline",
    ghostLight: "btn-ghost-light",
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
      resend: vi.fn(),
    },
  },
}));

import { SignupForm } from "@/components/site/SignupForm";

describe("SignupForm (pays et informations de l’atelier)", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    navigateMock.mockReset();
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("sélectionne Togo par défaut et propose Togo, Sénégal, Mali, Côte d’Ivoire et Autre", () => {
    render(<SignupForm initialPlan="pro" />);

    const countrySelect = screen.getByLabelText("Pays") as HTMLSelectElement;
    expect(countrySelect.value).toBe("Togo");
    expect(Array.from(countrySelect.options).map((o) => o.value)).toEqual([
      "Togo",
      "Sénégal",
      "Mali",
      "Côte d’Ivoire",
      "Autre",
    ]);
    expect(screen.queryByLabelText(/Nom du pays/i)).not.toBeInTheDocument();
  });

  it("affiche « Nom du pays » quand Autre est choisi, le masque et vide l’ancienne valeur si un autre pays est choisi ensuite", () => {
    render(<SignupForm initialPlan="pro" />);

    const countrySelect = screen.getByLabelText("Pays") as HTMLSelectElement;
    fireEvent.change(countrySelect, { target: { value: "Autre" } });

    const customInput = screen.getByLabelText(/Nom du pays/i) as HTMLInputElement;
    expect(customInput).toBeInTheDocument();
    fireEvent.change(customInput, { target: { value: "Bénin" } });
    expect(customInput.value).toBe("Bénin");

    fireEvent.change(countrySelect, { target: { value: "Mali" } });
    expect(screen.queryByLabelText(/Nom du pays/i)).not.toBeInTheDocument();

    fireEvent.change(countrySelect, { target: { value: "Autre" } });
    expect((screen.getByLabelText(/Nom du pays/i) as HTMLInputElement).value).toBe("");
  });

  it("affiche correctement le pays enregistré lors de la réouverture (y compris hors liste)", () => {
    render(<SignupForm initialPlan="simple" initialValues={{ workshop_country: "Ghana" }} />);

    const countrySelect = screen.getByLabelText("Pays") as HTMLSelectElement;
    expect(countrySelect.value).toBe("Autre");
    expect((screen.getByLabelText(/Nom du pays/i) as HTMLInputElement).value).toBe("Ghana");
  });

  it("envoie le pays saisi, un téléphone d’atelier non togolais et distingue les deux e-mails sans bloquer si les champs facultatifs sont vides", async () => {
    render(<SignupForm initialPlan="gold" />);

    fireEvent.change(screen.getByLabelText(/Nom de l’atelier/i), { target: { value: "Atelier Abidjan" } });
    fireEvent.change(screen.getByLabelText("Pays"), { target: { value: "Autre" } });
    fireEvent.change(screen.getByLabelText(/Nom du pays/i), { target: { value: "Burkina Faso" } });
    fireEvent.change(screen.getByLabelText(/Téléphone de l’atelier/i), { target: { value: "+226 70 11 22 33" } });
    fireEvent.change(screen.getByLabelText(/Adresse e-mail de l’atelier/i), { target: { value: "contact@atelier.bf" } });
    fireEvent.change(screen.getByLabelText(/Prénom/i), { target: { value: "Awa" } });
    fireEvent.change(screen.getByLabelText(/^Nom\s*\*/i), { target: { value: "Traoré" } });
    fireEvent.change(screen.getByLabelText("Numéro de téléphone"), { target: { value: "+22890123456" } });
    fireEvent.change(screen.getByLabelText("Email de connexion"), { target: { value: "awa@perso.bf" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "Secret-1234" } });
    fireEvent.change(screen.getByLabelText(/Confirmer le mot de passe/i), { target: { value: "Secret-1234" } });

    fireEvent.click(screen.getByRole("button", { name: /Démarrer l’essai Gold/i }));

    await waitFor(() => expect(signUpMock).toHaveBeenCalledTimes(1));
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "awa@perso.bf",
        options: expect.objectContaining({
          data: expect.objectContaining({
            workshop_name: "Atelier Abidjan",
            workshop_country: "Burkina Faso",
            workshop_phone: "+226 70 11 22 33",
            workshop_email: "contact@atelier.bf",
            workshop_address: "",
            workshop_city: "",
            workshop_description: "",
            plan: "gold",
          }),
        }),
      }),
    );
  });
});
