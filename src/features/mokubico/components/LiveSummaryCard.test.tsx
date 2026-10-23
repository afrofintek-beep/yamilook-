import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({error:false,empty:false}));
vi.mock('../hooks/useMokubicoData',()=>({
  useActiveLiveSession:()=>({data:null}),useBandaActiveCount:()=>({data:12}),useNovidadesCount:()=>({data:2}),
  useBandaActiveMembers:(open:boolean)=>({isLoading:false,isError:fixture.error,refetch:vi.fn(),data:open&&!fixture.empty?[{id:'member',display_name:'Pessoa da banda',username:'pessoa',avatar_url:null}]:[]})
}));
import { LiveSummaryCard } from './LiveSummaryCard';
const draw=()=>render(<MemoryRouter><Routes><Route path="/" element={<LiveSummaryCard/>}/><Route path="/profile/:id" element={<p>Perfil do membro</p>}/></Routes></MemoryRouter>);
beforeEach(()=>{fixture.error=false;fixture.empty=false;});afterEach(cleanup);
it('opens the banda members on tap and allows opening a public profile',()=>{
  draw();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Ver membros da banda ativa'}));
  expect(screen.getByRole('dialog')).toBeVisible();expect(screen.getByText('Pessoa da banda')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:/Pessoa da banda/}));
  expect(screen.getByText('Perfil do membro')).toBeVisible();
});
it('shows an actionable error instead of an unresponsive card',()=>{
  fixture.error=true;draw();fireEvent.click(screen.getByRole('button',{name:'Ver membros da banda ativa'}));
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a banda.');
  expect(screen.getByRole('button',{name:'Tentar novamente'})).toBeVisible();
});
it('explains an empty member list',()=>{
  fixture.empty=true;draw();fireEvent.click(screen.getByRole('button',{name:'Ver membros da banda ativa'}));
  expect(screen.getByText('A tua banda ainda não tem membros disponíveis.')).toBeVisible();
});
