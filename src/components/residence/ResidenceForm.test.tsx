import { useState } from 'react';
import { render,screen,fireEvent,cleanup } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
import { ResidenceForm } from './ResidenceForm';
import type { ResidencePlan } from '@/lib/residence';
let location: ReturnType<typeof vi.fn>;
const done=vi.fn();
function Harness(){const [n,setN]=useState('Talatona');const[c,setC]=useState('');const[plan,setPlan]=useState<ResidencePlan>({method:'later'});return <ResidenceForm country="AO" city="Luanda" neighborhood={n} customNeighborhood={c} onCountry={vi.fn()} onCity={vi.fn()} onNeighborhood={setN} onCustomNeighborhood={setC} plan={plan} onPlan={setPlan} onContinue={done}/>;}
beforeEach(()=>{done.mockClear();location=vi.fn();Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:location}});});
afterEach(cleanup);
it('can continue away from home without requesting or sending GPS',()=>{render(<Harness/>);fireEvent.click(screen.getByLabelText('Não, estou noutro local'));fireEvent.click(screen.getByText('Confirmar Banda e continuar'));expect(done).toHaveBeenCalledOnce();expect(location).not.toHaveBeenCalled();});
it('accepts a custom neighborhood without a separate hidden confirmation',()=>{render(<Harness/>);fireEvent.change(screen.getByLabelText('Bairro'),{target:{value:'__other__'}});expect(screen.getByText('Confirmar Banda e continuar')).toBeDisabled();fireEvent.change(screen.getByLabelText('Nome do teu bairro'),{target:{value:'Bairro novo'}});expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();});
it('requires explicit capture at home and reports permission refusal without trapping registration',()=>{render(<Harness/>);fireEvent.click(screen.getByLabelText('Sim, estou no meu endereço'));expect(location).not.toHaveBeenCalled();expect(screen.getByText('Confirmar Banda e continuar')).toBeDisabled();location.mockImplementation((_ok,fail)=>fail({code:1}));fireEvent.click(screen.getByText('Captar localização do meu endereço'));expect(screen.getByRole('alert')).toHaveTextContent('confirmar mais tarde');fireEvent.click(screen.getByLabelText('Confirmar mais tarde'));expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();});
it('does not treat an existing address as a validated residence',()=>{render(<Harness/>);fireEvent.click(screen.getByLabelText('Já tenho um endereço AFROLOC'));expect(screen.getByText('Confirmar Banda e continuar')).toBeDisabled();fireEvent.change(screen.getByLabelText('Código AFROLOC existente'),{target:{value:'AO-LDA-TAL-G10-ABC-DEF'}});expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();expect(screen.getByText(/direito de utilização será verificado/)).toBeVisible();expect(location).not.toHaveBeenCalled();});

it('captures at home without claiming residency is already verified',()=>{
 render(<Harness/>);fireEvent.click(screen.getByLabelText('Sim, estou no meu endereço'));
 location.mockImplementation(ok=>ok({coords:{latitude:-8.9,longitude:13.2,accuracy:20}}));
 fireEvent.click(screen.getByText('Captar localização do meu endereço'));
 expect(screen.getByRole('status')).toHaveTextContent('validação da residência fica pendente');
 expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();
});
it('ignores a GPS response after the user switches to deferred confirmation',()=>{
 let success: (p:unknown)=>void=()=>{};location.mockImplementation(ok=>{success=ok;});
 render(<Harness/>);fireEvent.click(screen.getByLabelText('Sim, estou no meu endereço'));fireEvent.click(screen.getByText('Captar localização do meu endereço'));
 fireEvent.click(screen.getByLabelText('Confirmar mais tarde'));success({coords:{latitude:1,longitude:2,accuracy:10}});
 expect(screen.queryByText(/Precisão indicada/)).not.toBeInTheDocument();expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();
});
