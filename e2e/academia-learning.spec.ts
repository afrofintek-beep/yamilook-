import { test, expect, devices, type Page } from '@playwright/test';
const learner = '11111111-1111-4111-8111-111111111111';
const mentor = '22222222-2222-4222-8222-222222222222';
const goalId = '33333333-3333-4333-8333-333333333333';
const taskId = '44444444-4444-4444-8444-444444444444';
const profile = (id: string) => ({ id, display_name: id === learner ? 'António' : 'Maria', username: id === learner ? 'aluno' : 'mentora', onboarding_completed: true, app_tour_completed: true, avatar_url: null });
// Simulated transport for UI testing only. SQL security and transitions are
// independently tested against Postgres in scripts/test-academia-learning.mjs.
test('learner and mentor complete a private goal with revision on a mobile screen', async ({ browser }) => {
  test.setTimeout(60000);
  let goal: Record<string, unknown> | null = null;
  const tasks: Record<string, unknown>[] = [], submissions: Record<string, unknown>[] = [];
  async function setup(page: Page, user: string) {
    await page.route('**/127.0.0.1:54321/**', async route => {
      const url = new URL(route.request().url()), name = url.pathname.split('/').pop();
      let data: unknown = [];
      if (name === 'user') data = { id: user, email: 'test@example.invalid' };
      if (name === 'profiles') data = profile(user);
      if (name === 'public_profiles') data = [profile(learner), profile(mentor)];
      if (name === 'get_public_profiles_by_ids') data = [profile(learner), profile(mentor)];
      if (name === 'mentor_profiles') data = [{ user_id: mentor, specialty: 'Negócios', mentor_bio: '', is_verified_mentor: true }];
      if (name === 'academia_goals') data = url.searchParams.has('id') ? goal : goal ? [goal] : [];
      if (name === 'academia_challenges') data = tasks;
      if (name === 'academia_submissions') data = submissions.slice().reverse();
      if (name === 'academia_learning_progress') data = goal ? [{ goal_id: goalId, total: tasks.length, approved: tasks.filter(t => t.status === 'approved').length }] : [];
      if (name === 'academia-learning') {
        const input = route.request().postDataJSON(), p = input.payload || {}, now = new Date().toISOString();
        if (input.action === 'create') goal = { id: goalId, learner_id: learner, mentor_id: mentor, title: p.title, context: p.context, plan: '', closure_reason: '', status: 'requested', created_at: now, updated_at: now };
        if (input.action === 'plan' && goal) { goal.plan = p.plan; goal.status = 'active'; }
        if (input.action === 'challenge') tasks.push({ id: taskId, goal_id: goalId, position: 1, title: p.title, instructions: p.instructions, skill: p.skill, status: 'open', created_at: now });
        if (input.action === 'submit') { submissions.push({ id: `submission-${submissions.length}`, challenge_id: taskId, content: p.content, evidence_url: p.evidence_url, status: 'pending', feedback: '', created_at: now, reviewed_at: null }); tasks[0].status = 'submitted'; }
        if (input.action === 'review') { const s = submissions.find(s => s.id === p.submission_id)!; s.status = p.decision; s.feedback = p.feedback; tasks[0].status = p.decision; }
        if (input.action === 'complete' && goal) goal.status = 'completed';
        data = { id: goalId };
      }
      await route.fulfill({ json: data });
    });
    await page.addInitScript(userId => {
      const session = JSON.stringify({ access_token: btoa('{}') + '.' + btoa(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature', refresh_token: 'test-only', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: userId, email: 'test@example.invalid' } });
      localStorage.setItem('undefined', session); localStorage.setItem('sb-127-auth-token', session);
    }, user);
  }
  const studentContext = await browser.newContext({ ...devices['iPhone 13'], baseURL: 'http://localhost:8092', serviceWorkers: 'block' });
  const mentorContext = await browser.newContext({ ...devices['iPhone 13'], baseURL: 'http://localhost:8092', serviceWorkers: 'block' });
  try {
    const student = await studentContext.newPage(), teacher = await mentorContext.newPage();
    await setup(student, learner); await setup(teacher, mentor);
    await student.goto('/academia/percursos');
    await student.getByRole('button', { name: 'Criar o meu objetivo' }).click();
    await student.getByRole('button', { name: 'Usar exemplo: primeira venda' }).click();
    await student.getByLabel('Escolher mentor').selectOption(mentor);
    await student.getByRole('button', { name: 'Pedir acompanhamento' }).click();
    await expect(student.getByText('A aguardar o mentor', { exact: true })).toBeVisible();
    await teacher.goto(`/academia/percursos/${goalId}`);
    await teacher.getByLabel('Como vais acompanhar o aluno?').fill('Vamos preparar e avaliar a ficha de custos do teu produto.');
    await teacher.getByRole('button', { name: 'Aceitar acompanhamento' }).click();
    await expect(teacher.getByRole('form', { name: 'Novo desafio' })).toBeVisible();
    await teacher.getByLabel('Título do desafio').fill('Calcular preço');
    await teacher.getByLabel('O que deve ser entregue e como será avaliado?').fill('Entrega uma ficha com todos os custos e o preço final.');
    await teacher.getByLabel('Competência a demonstrar').fill('Formação de preços');
    await teacher.getByRole('button', { name: 'Adicionar desafio' }).click();
    await expect(teacher.getByRole('heading', { name: 'Calcular preço' })).toBeVisible();
    await student.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await student.getByLabel('Descreve o trabalho que realizaste').fill('O meu custo é 100 e vendo a 150.');
    await student.getByRole('button', { name: 'Entregar trabalho' }).click();
    await expect(student.getByText('Em avaliação', { exact: true })).toBeVisible();
    await teacher.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await teacher.getByLabel('Feedback para o aluno').fill('Falta incluir o transporte.');
    await teacher.getByRole('button', { name: 'Pedir revisão' }).click();
    await student.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await student.getByLabel('Descreve o trabalho que realizaste').fill('Com transporte o custo é 110 e vendo a 160.');
    await student.getByRole('button', { name: 'Enviar nova versão' }).click();
    await teacher.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await teacher.getByLabel('Feedback para o aluno').fill('Custos completos e preço justificado.');
    await teacher.getByRole('button', { name: 'Validar trabalho' }).click();
    await teacher.getByRole('button', { name: 'Concluir percurso validado' }).click();
    await expect(teacher.getByText('Concluído', { exact: true })).toBeVisible();
    await student.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await expect(student.getByRole('heading', { name: 'Competências demonstradas' })).toBeVisible();
    await expect(student.getByText('Concluído', { exact: true })).toBeVisible();
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
      await student.setViewportSize(size);
      await expect.poll(() => student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await student.setViewportSize({ width: 390, height: 844 });
    await student.screenshot({ path: test.info().outputPath('academia-percurso-mobile.png'), fullPage: true });
  } finally { await studentContext.close(); await mentorContext.close(); }
});
