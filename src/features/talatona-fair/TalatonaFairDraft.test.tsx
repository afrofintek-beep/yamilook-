import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  profile: null as { id: string } | null,
  loading: false,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
afterEach(() => {
  auth.user = null;
  auth.profile = null;
  vi.unstubAllEnvs();
});
vi.mock("@/components/residence/ResidencePanel", () => ({ ResidencePanel: () => null }));
vi.mock("@/components/account-link/AuthorizedAfrolocLink", () => ({ default: () => null }));
import TalatonaFairDraft from "./TalatonaFairDraft";

describe("Talatona Christmas fair draft", () => {
  it("clears the address step and condominium when the account changes", () => {
    vi.stubEnv("VITE_ACCOUNT_LINK_V1_ENABLED", "false");
    auth.user = { id: "first" };
    auth.profile = { id: "first" };
    const { rerender } = render(<TalatonaFairDraft />);
    fireEvent.change(screen.getByRole("combobox", { name: "Condomínio" }), { target: { value: "Adelaide" } });
    fireEvent.click(screen.getByRole("button", { name: "Preparar o meu endereço" }));
    expect(screen.getByText("A confirmação do endereço pelo AFROLOC ficará disponível após a activação do serviço.")).toBeInTheDocument();
    auth.user = { id: "second" };
    auth.profile = { id: "second" };
    rerender(<TalatonaFairDraft />);
    expect(screen.getByRole("combobox", { name: "Condomínio" })).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Fechar dados de residência" })).not.toBeInTheDocument();
  });

  it("lets residents review the catalogue without sending a selection or opening registrations", () => {
    render(<TalatonaFairDraft />);

    const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Condomínio" });
    expect(screen.getByRole("option", { name: "Adelaide" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Vila Kuditemo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "O meu condomínio não está na lista" })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "Vila Kuditemo" } });
    expect(select).toHaveValue("Vila Kuditemo");
    expect(screen.getByRole("link", { name: "Abrir o AFROLOC" })).toHaveAttribute("href", "https://www.afroloc.ao/");
    expect(screen.getByText("Inscrições e convites ainda por abrir.")).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "none" } });
    expect(select).toHaveValue("none");
  });
});
