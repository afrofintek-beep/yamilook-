import { test, expect } from "@playwright/test";
const me = "11111111-1111-4111-8111-111111111111",
  chat = "33333333-3333-4333-8333-333333333333";
const peers = Array.from(
  { length: 9 },
  (_, i) => `22222222-2222-4222-8222-${String(i + 1).padStart(12, "0")}`,
);
const profile = (id: string) => ({
  id,
  display_name: id === me ? "Teste local" : `Membro ${peers.indexOf(id) + 1}`,
  username: `membro${peers.indexOf(id) + 1}`,
  onboarding_completed: true,
  app_tour_completed: true,
  avatar_url: null,
});
async function setup(page: import("@playwright/test").Page) {
  await page.route("**/papos-app/**", async (route) =>
    route.request().isNavigationRequest()
      ? route.fulfill({
          response: await page.request.get("/papos-app/index.html"),
        })
      : route.continue(),
  );
  await page.route("**/127.0.0.1:54321/**", async (route) => {
    const url = new URL(route.request().url()),
      table = url.pathname.split("/").pop();
    let data: unknown = [];
    if (table === "user") data = { id: me, email: "test@example.invalid" };
    if (table === "profiles") data = profile(me);
    if (table === "public_profiles") data = [me, ...peers].map(profile);
    if (table === "get_public_profiles_by_ids")
      data = (route.request().postDataJSON()?.p_ids || []).map(profile);
    if (table === "conversation_participants")
      data = [me, ...peers].map((id) => ({
        conversation_id: chat,
        user_id: id,
        is_archived: false,
      }));
    if (table === "conversations")
      data = [
        {
          id: chat,
          type: "group",
          name: "Grupo de teste",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    if (table === "get_my_conversations")
      data = [
        {
          id: chat,
          type: "group",
          name: "Grupo de teste",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          participants: [me, ...peers].map((id) => ({
            user_id: id,
            profile: profile(id),
          })),
        },
      ];
    if (table === "recording_session") data = null;
    if (table === "group_conference_action")
      data = route.request().postDataJSON()?.p_action === "current" ? null : [];
    if (table === "contacts")
      data = peers.map((id) => ({
        id,
        contact_user_id: id,
        user_id: me,
        is_blocked: false,
        profile: profile(id),
      }));
    await route.fulfill({ json: data });
  });
  await page.addInitScript((me) => {
    localStorage.setItem("i18nextLng", "pt");
    localStorage.setItem(
      "sb-127-papos-auth-token",
      JSON.stringify({
        access_token:
          btoa("{}") +
          "." +
          btoa(
            JSON.stringify({
              sub: me,
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          ) +
          ".signature",
        refresh_token: "test-only",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: { id: me, email: "test@example.invalid" },
      }),
    );
  }, me);
}
test("contacts exposes group creation without opening add-contact search", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/papos-app/contacts");
  await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Novo Grupo" })).toBeVisible();
  await expect(page.getByPlaceholder("Pesquisar contactos...")).toBeVisible();
});
test("group voice button selects multiple members and enforces seven invitees", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/papos-app/chat/${chat}`);
  await page
    .getByRole("button", { name: "Chamada de voz", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Participantes da conferência",
  });
  await expect(dialog).toBeVisible();
  const checkboxes = dialog.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(9);
  for (let i = 0; i < 7; i++) await checkboxes.nth(i).check();
  await expect(checkboxes.nth(7)).toBeDisabled();
  await expect(checkboxes.nth(8)).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Iniciar conferência" }),
  ).toBeEnabled();
  await checkboxes.nth(0).uncheck();
  await expect(checkboxes.nth(7)).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
