import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { Community, Cohort, PublicWork } from '../hooks/useAcademiaCommunity';
const community:Community={slug:'criacao-digital',title:'Criação digital e comunicação',description:'Fotografia, vídeo e design.',position:1,starter_title:'Criar uma apresentação digital',starter_instructions:'Apresenta um cartaz para um negócio.',starter_skill:'Comunicação digital'};
const cohort:Cohort={id:'11111111-1111-4111-8111-111111111111',community_slug:community.slug,mentor_id:'mentor',mentor_name:'Maria',title:'Preparar o meu primeiro cartaz',plan:'Vamos preparar e avaliar o teu cartaz.',challenge_title:'Criar um cartaz',instructions:'Entrega um cartaz com uma mensagem clara.',skill:'Comunicação digital',level:'beginner',language:'Português',locality:'Online',requirements:'Telemóvel e papel.',capacity:10,seats_taken:0,status:'open',created_at:'2026-10-29'};
const proof:PublicWork={id:'22222222-2222-4222-8222-222222222222',community_slug:community.slug,cohort_id:cohort.id,title:'Criar um cartaz',skill:'Comunicação digital',caption:'Preparei o meu primeiro cartaz.',learner_name:'António',mentor_name:'Maria',evidence_url:null,published:true,created_at:'2026-10-29'};
const state=vi.hoisted(()=>({user:'learner' as string|null,mentor:false,cohort:null as Cohort|null,work:null as PublicWork|null,own:null as PublicWork|null,members:[] as {id:string;learner_id:string;goal_id:string;name:string;source_work_id:string|null;progress:{approved:number;total:number}}[],mutate:vi.fn(),mutateAsync:vi.fn()}));
vi.mock('@tanstack/react-query', () => ({useQueryClient:()=>({invalidateQueries:vi.fn()})}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:state.user?{id:state.user}:null,profile:{onboarding_completed:true}})}));
vi.mock('../hooks/useAcademia',()=>({useIsMentor:()=>({data:state.mentor})}));
vi.mock('../hooks/useAcademiaCommunity',()=>({
 useCommunities:()=>({data:[community],isLoading:false,isError:false}),
 useCommunityCohorts:()=>({data:state.cohort?[state.cohort]:[],isLoading:false,isError:false}),
 usePublicWorks:()=>({data:state.work?[state.work]:[],isLoading:false,isError:false}),
 useCohort:()=>({data:state.cohort,isLoading:false,isError:false}),
 usePublicWork:()=>({data:state.work,isLoading:false,isError:false}),
 useOwnWork:()=>({data:state.own,isLoading:false,isError:false}),
 useGoalCommunity:()=>({data:'criacao-digital',isLoading:false,isError:false}),
 useCohortMembers:()=>({data:state.members,isLoading:false,isError:false}),
 useCommunityAction:()=>({mutate:state.mutate,mutateAsync:state.mutateAsync,isPending:false}),
}));
import AcademiaCommunities from './AcademiaCommunities';
import AcademiaCohort from './AcademiaCohort';
import AcademiaPublicWork from './AcademiaPublicWork';
import { ShareValidatedWork } from '../components/ShareValidatedWork';
function draw(path:string){render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/academia/comunidades" element={<AcademiaCommunities/>}/><Route path="/academia/comunidades/:slug" element={<AcademiaCommunities/>}/><Route path="/academia/comunidades/:slug/turmas/:cohortId" element={<AcademiaCohort/>}/><Route path="/academia/trabalhos/:workId" element={<AcademiaPublicWork/>}/><Route path="/academia/percursos/new-goal" element={<p>O meu percurso privado</p>}/></Routes></MemoryRouter>);}
beforeEach(()=>{vi.clearAllMocks();state.user='learner';state.mentor=false;state.cohort={...cohort};state.work=null;state.own=null;state.members=[];state.mutateAsync.mockResolvedValue('new-goal');});
afterEach(cleanup);
it('lets visitors discover an area without signing in',()=>{
 state.user=null;draw('/academia/comunidades');
 expect(screen.getByRole('link',{name:/Criação digital e comunicação/})).toHaveAttribute('href','/academia/comunidades/criacao-digital');
});
it('shows honest empty states without inventing participants or public work',()=>{
 state.cohort=null;draw('/academia/comunidades/criacao-digital');
 expect(screen.getByText(/Ainda não há turmas/)).toBeVisible();expect(screen.getByText('Os primeiros trabalhos partilhados aparecerão aqui.')).toBeVisible();
});
it('filters by experience and locality',()=>{
 draw('/academia/comunidades/criacao-digital');
 expect(screen.getByText(cohort.title)).toBeVisible();
 fireEvent.change(screen.getByLabelText('Ponto de partida'),{target:{value:'advanced'}});
 expect(screen.queryByText(cohort.title)).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Ponto de partida'),{target:{value:'all'}});
 fireEvent.change(screen.getByLabelText('Localidade ou online'),{target:{value:'Huambo'}});
 expect(screen.queryByText(cohort.title)).not.toBeInTheDocument();
});
it('lets a mentor start from the community template and declare requirements',async()=>{
 state.user='mentor';state.mentor=true;draw('/academia/comunidades/criacao-digital');
 fireEvent.click(screen.getByRole('button',{name:'Abrir turma como mentor'}));
 fireEvent.click(screen.getByRole('button',{name:'Usar exemplo desta comunidade'}));
 fireEvent.change(screen.getByLabelText('Material, ferramentas e condições necessárias'),{target:{value:'Telemóvel e papel.'}});
 fireEvent.submit(screen.getByRole('form',{name:'Abrir turma'}));
 await waitFor(()=>expect(state.mutateAsync).toHaveBeenCalledWith({action:'cohort_create',payload:expect.objectContaining({community_slug:'criacao-digital',capacity:10,level:'beginner',requirements:'Telemóvel e papel.',challenge_title:community.starter_title})}));
});
it('preserves the challenge and referral in the sign-in destination',()=>{
 state.user=null;draw(`/academia/comunidades/criacao-digital/turmas/${cohort.id}?origem=${proof.id}`);
 const href=screen.getByRole('link',{name:'Entrar para participar gratuitamente'}).getAttribute('href')!;
 expect(new URLSearchParams(href.split('?')[1]).get('next')).toBe(`/academia/comunidades/criacao-digital/turmas/${cohort.id}?origem=${proof.id}`);
});
it('enrolls into a private journey and attributes an explicitly shared proof',async()=>{
 draw(`/academia/comunidades/criacao-digital/turmas/${cohort.id}?origem=${proof.id}`);
 fireEvent.click(screen.getByRole('button',{name:'Participar gratuitamente'}));
 await screen.findByText('O meu percurso privado');
 expect(state.mutateAsync).toHaveBeenCalledWith({action:'cohort_join',targetId:cohort.id,payload:{source_work_id:proof.id}});
});
it('keeps an enrolled learner out of the mentor roster even when the query fixture contains other names',()=>{
 state.members=[{id:'own',learner_id:'learner',goal_id:'own-goal',name:'Eu',source_work_id:null,progress:{approved:0,total:1}},{id:'other',learner_id:'other',goal_id:'other-goal',name:'Colega privado',source_work_id:null,progress:{approved:1,total:1}}];
 draw(`/academia/comunidades/criacao-digital/turmas/${cohort.id}`);
 expect(screen.getByRole('link',{name:'Abrir o meu percurso privado'})).toBeVisible();expect(screen.queryByText(/Colega privado/)).not.toBeInTheDocument();
});
it('disables new entry to a full cohort',()=>{
 state.cohort!.seats_taken=10;draw(`/academia/comunidades/criacao-digital/turmas/${cohort.id}`);
 expect(screen.getByRole('button',{name:'Inscrições encerradas'})).toBeDisabled();expect(state.mutateAsync).not.toHaveBeenCalled();
});
it('only the mentor sees the roster and can close registrations',()=>{
 state.user='mentor';state.members=[{id:'member',learner_id:'learner',goal_id:'goal',name:'António',source_work_id:proof.id,progress:{approved:1,total:1}}];
 draw(`/academia/comunidades/criacao-digital/turmas/${cohort.id}`);
 expect(screen.getByRole('link',{name:/António/})).toHaveAttribute('href','/academia/percursos/goal');
 expect(screen.getByText(/1 entradas por partilha/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Fechar inscrições'}));expect(state.mutate).toHaveBeenCalledWith({action:'cohort_close',targetId:cohort.id});
});
it('does not publish until the learner writes a caption and explicitly consents',()=>{
 render(<ShareValidatedWork challenge={{id:'task',goal_id:'goal',position:1,title:'Criar um cartaz',instructions:'Entrega um cartaz.',skill:'Comunicação digital',status:'approved',created_at:'2026-10-29'}}/>);
 expect(state.mutate).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Partilhar este trabalho'}));
 expect(screen.getByRole('button',{name:'Publicar apresentação'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('O que queres mostrar sobre o teu trabalho?'),{target:{value:'Preparei um cartaz.'}});
 expect(screen.getByRole('button',{name:'Publicar apresentação'})).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox',{name:/Quero tornar públicos/}));
 fireEvent.submit(screen.getByRole('form',{name:'Publicar Criar um cartaz'}));
 expect(state.mutate).toHaveBeenCalledWith({action:'work_publish',targetId:'task',payload:{caption:'Preparei um cartaz.',community_slug:'criacao-digital',consent:true,include_evidence:false}});
});
it('lets the owner withdraw a public presentation',()=>{
 state.own={...proof};render(<ShareValidatedWork challenge={{id:'task',goal_id:'goal',position:1,title:'Criar um cartaz',instructions:'Entrega um cartaz.',skill:'Comunicação digital',status:'approved',created_at:'2026-10-29'}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Partilhar este trabalho'}));fireEvent.click(screen.getByRole('button',{name:'Retirar da apresentação pública'}));
 expect(state.mutate).toHaveBeenCalledWith({action:'work_hide',targetId:proof.id});
 expect(screen.getByRole('link',{name:'Ver a apresentação pública'})).toHaveAttribute('href',`https://www.yamilook.com/academia/trabalhos/${proof.id}`);
});
it('a public proof leads back to its challenge without exposing a private journey link',()=>{
 state.user=null;state.work={...proof};draw(`/academia/trabalhos/${proof.id}`);
 expect(screen.getByRole('link',{name:'Quero aprender também'})).toHaveAttribute('href',`/academia/comunidades/criacao-digital/turmas/${cohort.id}?origem=${proof.id}`);
 expect(screen.queryByRole('link',{name:/percurso privado/})).not.toBeInTheDocument();expect(screen.queryByText(/feedback/i)).not.toBeInTheDocument();
});
it('withdrawn or unavailable presentations disclose no public work',()=>{
 state.user=null;state.work=null;draw(`/academia/trabalhos/${proof.id}`);
 expect(screen.getByText('Esta apresentação não está disponível publicamente.')).toBeVisible();expect(screen.queryByText(proof.caption)).not.toBeInTheDocument();
});
