import { test, expect } from '@playwright/test';
const user = '11111111-1111-4111-8111-111111111111';
const mentorId = '22222222-2222-4222-8222-222222222222';
// UI transport is simulated; PostgreSQL role/RLS enforcement is tested independently.
test('mobile administrator approves, verifies and suspends with recorded reasons', async ({ page }) => {
  const mentor = { user_id: mentorId, display_name: 'Ana Mentor', username: 'ana', specialty: 'Música', mentor_bio: 'Formadora de música', experience: 'Dez anos de formação', status: 'pending', is_verified_mentor: false, pending_sessions: 0, latest_action: 'apply' };
  const decisions: { p_user: string; p_action: string; p_reason: string }[] = [];
  await page.route('**/127.0.0.1:54321/**', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    let data: unknown = [];
    if (name === 'user') data = { id: user, email: 'test@example.invalid' };
    if (name === 'profiles') data = { id: user, display_name: 'Admin', username: 'admin', onboarding_completed: true, app_tour_completed: true, avatar_url: null };
    if (name === 'has_role') data = true;
    if (name === 'academia_admin_mentors') data = [mentor];
    if (name === 'academia_manage_mentor') {
      const input = route.request().postDataJSON(); decisions.push(input);
      if (input.p_action === 'approve') mentor.status = 'active';
      if (input.p_action === 'verify') mentor.is_verified_mentor = true;
      if (input.p_action === 'suspend') { mentor.status = 'suspended'; mentor.is_verified_mentor = false; }
      data = { ok: true };
    }
    await route.fulfill({ json: data });
  });
  await page.addInitScript(userId => {
    const session = JSON.stringify({ access_token: btoa('{}') + '.' + btoa(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature', refresh_token: 'test-only', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: userId, email: 'test@example.invalid' } });
    localStorage.setItem('undefined', session); localStorage.setItem('sb-127-auth-token', session);
  }, user);
  await page.goto('/admin/mentors');
  await expect(page.getByRole('heading', { name: 'Gestão de Mentores' })).toBeVisible();
  await page.getByLabel('Pesquisar mentores').fill('@ana');
  await expect(page.getByRole('button', { name: 'Verificar para cobrar' })).toHaveCount(0);
  for (const [label, action, reason] of [['Aprovar','approve','Experiência confirmada'], ['Verificar para cobrar','verify','Credenciais verificadas'], ['Suspender','suspend','Reclamação em análise']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirmar decisão' })).toBeDisabled();
    await page.getByLabel('Motivo da decisão').fill(reason);
    await page.getByRole('button', { name: 'Confirmar decisão' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(decisions.at(-1)).toEqual({ p_user: mentorId, p_action: action, p_reason: reason });
  }
  await expect(page.locator('section').getByText('Suspenso', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reactivar' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mentor-governance-mobile.png', fullPage: true });
});
