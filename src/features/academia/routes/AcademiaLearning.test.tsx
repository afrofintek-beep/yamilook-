import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LearningGoal, LearningChallenge, LearningSubmission } from '../hooks/useAcademiaLearning';
const state = vi.hoisted(() => ({
  user: 'learner', goal: null as LearningGoal | null, challenges: [] as LearningChallenge[], submissions: [] as LearningSubmission[],
  error: false, mutate: vi.fn(), mutateAsync: vi.fn(), refetch: vi.fn(), noMentors: false,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: state.user } }) }));
vi.mock('../hooks/useAcademia', () => ({ useAcademiaMentors: () => ({ data: state.noMentors ? [] : [{ id: 'mentor', name: 'Maria', specialty: 'Negócios' }, { id: 'learner', name: 'Eu', specialty: 'Teste' }], isLoading: false, isError: false }) }));
vi.mock('../hooks/useAcademiaLearning', () => ({
  learningStatus: { requested: 'A aguardar o mentor', active: 'Em curso', completed: 'Concluído', submitted: 'Em avaliação', approved: 'Validado', revision: 'Rever e entregar novamente', open: 'Por entregar' },
  useLearningAction: () => ({ mutate: state.mutate, mutateAsync: state.mutateAsync, isPending: false }),
  useLearningGoals: () => ({ data: state.goal ? [{ ...state.goal, mentorName: 'Maria', learnerName: 'António', total: 1, approved: 0 }] : [], isLoading: false, isError: state.error, refetch: state.refetch }),
  useLearningGoal: () => ({ data: state.goal ? { goal: state.goal, challenges: state.challenges, submissions: state.submissions, mentorName: 'Maria', learnerName: 'António' } : null, isLoading: false, isError: state.error, refetch: state.refetch }),
}));
import AcademiaLearning from './AcademiaLearning';
import AcademiaLearningGoal from './AcademiaLearningGoal';
import { safeEvidenceUrl } from '../learning-evidence';
const goal: LearningGoal = { id: 'goal', learner_id: 'learner', mentor_id: 'mentor', title: 'Preparar a primeira venda', context: 'Quero vender bolos.', plan: 'Vamos preparar a oferta.', closure_reason: '', status: 'active', created_at: '2026-10-29', updated_at: '2026-10-29' };
const task: LearningChallenge = { id: 'task', goal_id: 'goal', position: 1, title: 'Calcular preço', instructions: 'Apresenta os custos.', skill: 'Formação de preços', status: 'open', created_at: '2026-10-29' };
const submission: LearningSubmission = { id: 'submission', challenge_id: 'task', content: 'Os custos são estes.', evidence_url: 'https://example.org/trabalho', status: 'pending', feedback: '', created_at: '2026-10-29', reviewed_at: null };
function list() { render(<MemoryRouter initialEntries={['/academia/percursos']}><Routes><Route path="/academia/percursos" element={<AcademiaLearning />} /><Route path="/academia/percursos/new-goal" element={<p>Objetivo enviado</p>} /></Routes></MemoryRouter>); }
function detail() { render(<MemoryRouter initialEntries={['/academia/percursos/goal']}><Routes><Route path="/academia/percursos/:goalId" element={<AcademiaLearningGoal />} /></Routes></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); state.user = 'learner'; state.goal = { ...goal }; state.challenges = [{ ...task }]; state.submissions = []; state.error = false; state.noMentors = false; state.mutateAsync.mockResolvedValue('new-goal'); });
afterEach(cleanup);
it('creates a first-sale goal with a distinct mentor and opens the new journey', async () => {
  list(); fireEvent.click(screen.getByRole('button', { name: 'Criar o meu objetivo' }));
  expect(screen.queryByRole('option', { name: 'Eu — Teste' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Usar exemplo: primeira venda' }));
  fireEvent.change(screen.getByLabelText('Escolher mentor'), { target: { value: 'mentor' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Novo objetivo' }));
  await screen.findByText('Objetivo enviado');
  expect(state.mutateAsync).toHaveBeenCalledWith({ action: 'create', payload: { title: 'Da ideia à primeira venda', context: expect.any(String), mentor_id: 'mentor' } });
});
it('separates learner goals and mentor requests', () => {
  list(); expect(screen.getByText(goal.title)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'A acompanhar como mentor' }));
  expect(screen.queryByText(goal.title)).not.toBeInTheDocument();
  expect(screen.getByText('Os pedidos dos alunos aparecerão aqui.')).toBeVisible();
});
it('prevents requesting a mentor when none is available', () => {
  state.noMentors = true; list(); fireEvent.click(screen.getByRole('button', { name: 'Criar o meu objetivo' }));
  expect(screen.getByRole('button', { name: 'Pedir acompanhamento' })).toBeDisabled();
  expect(screen.getByText(/Ainda não há outro mentor/)).toBeVisible();
});
it('distinguishes an unavailable list from an empty list and allows retry', () => {
  state.error = true; state.goal = null; list();
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.queryByText(/Ainda não tens percursos/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })); expect(state.refetch).toHaveBeenCalledOnce();
});
it('allows a mentor to accept a request with the starter plan', () => {
  state.user = 'mentor'; state.goal!.status = 'requested'; state.goal!.plan = ''; state.challenges = []; detail();
  expect(screen.queryByRole('form', { name: 'Novo desafio' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /Usar modelo/ }));
  fireEvent.submit(screen.getByRole('form', { name: 'Plano de acompanhamento' }));
  expect(state.mutate).toHaveBeenCalledWith({ action: 'plan', goalId: 'goal', payload: { plan: expect.stringContaining('calcular custos'), template: 'first_sale' } });
});
it('lets only the learner submit work and keeps mentor controls hidden', async () => {
  detail(); expect(screen.queryByRole('form', { name: 'Novo desafio' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Concluir percurso validado' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Descreve o trabalho que realizaste'), { target: { value: 'Uma ficha de custos.' } });
  fireEvent.change(screen.getByLabelText('Ligação para o trabalho (opcional)'), { target: { value: 'https://example.org/custos' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Entregar Calcular preço' }));
  await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledWith({ action: 'submit', goalId: 'goal', payload: { challenge_id: 'task', content: 'Uma ficha de custos.', evidence_url: 'https://example.org/custos' } }));
});
it('lets a mentor request revision with feedback and prevents early completion', () => {
  state.user = 'mentor'; state.challenges[0].status = 'submitted'; state.submissions = [{ ...submission }]; detail();
  expect(screen.queryByRole('form', { name: 'Entregar Calcular preço' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Concluir percurso validado' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Validar trabalho' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Feedback para o aluno'), { target: { value: 'Inclui o custo de transporte.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pedir revisão' }));
  expect(state.mutate).toHaveBeenCalledWith({ action: 'review', goalId: 'goal', payload: { challenge_id: 'task', submission_id: 'submission', decision: 'revision', feedback: 'Inclui o custo de transporte.' } }, expect.any(Object));
});
it('shows feedback and allows a new version after revision', () => {
  state.challenges[0].status = 'revision'; state.submissions = [{ ...submission, status: 'revision', feedback: 'Revê o preço.' }]; detail();
  expect(screen.getByText('Revê o preço.', { exact: false })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Enviar nova versão' })).toBeVisible();
});
it('shows demonstrated skills and makes completed work read-only', () => {
  state.user = 'mentor'; state.goal!.status = 'completed'; state.challenges[0].status = 'approved'; state.submissions = [{ ...submission, status: 'approved', feedback: 'Bom trabalho.' }]; detail();
  expect(screen.getByRole('heading', { name: 'Competências demonstradas' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Validar trabalho' })).not.toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Novo desafio' })).not.toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Plano de acompanhamento' })).not.toBeInTheDocument();
});
it('does not turn unsafe evidence URLs into clickable links', () => {
  expect(safeEvidenceUrl('javascript:alert(1)')).toBeNull(); expect(safeEvidenceUrl('data:text/html,bad')).toBeNull();
  expect(safeEvidenceUrl('https://example.org/prova')).toBe('https://example.org/prova');
});
