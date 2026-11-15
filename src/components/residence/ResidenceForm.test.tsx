import { useState } from 'react';
import { render,screen,fireEvent,cleanup } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('./ResidenceMapPicker',()=>({default:({onChange}:{onChange:(p:{lat:number;lng:number})=>void})=><button onClick={()=>onChange({lat:-8.9,lng:13.2})}>Marcar casa de teste</button>}));
import { ResidenceForm } from './ResidenceForm';
import type { ResidencePlan } from '@/lib/residence';
let location: ReturnType<typeof vi.fn>;
const done=vi.fn();
function Harness(){const [n,setN]=useState('Talatona');const[c,setC]=useState('');const[plan,setPlan]=useState<ResidencePlan>({method:'later',administrative:{province:'AO-LDA',municipality:'AO-LDA-TALATONA',commune:'AO-LDA-KTALATONA'}});return <ResidenceForm country="AO" city="Luanda" neighborhood={n} customNeighborhood={c} onCountry={vi.fn()} onCity={vi.fn()} onNeighborhood={setN} onCustomNeighborhood={setC} plan={plan} onPlan={setPlan} onContinue={done}/>;}
beforeEach(()=>{done.mockClear();location=vi.fn();Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:location}});});
afterEach(cleanup);
it('can continue away from home without requesting or sending GPS',()=>{render(<Harness/>);fireEvent.click(screen.getByLabelText('Quero criar um endereço'));fireEvent.click(screen.getByLabelText('Não, estou noutro local'));fireEvent.click(screen.getByText('Confirmar Banda e continuar'));expect(done).toHaveBeenCalledOnce();expect(location).not.toHaveBeenCalled();});
it('accepts a free local neighborhood within the official hierarchy',()=>{render(<Harness/>);fireEvent.change(screen.getByLabelText('Bairro / povoação / localidade'),{target:{value:''}});expect(screen.getByText('Confirmar Banda e continuar')).toBeDisabled();fireEvent.change(screen.getByLabelText('Bairro / povoação / localidade'),{target:{value:'Bairro novo'}});expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();});
it('requires explicit capture at home and reports permission refusal without trapping registration',()=>{render(<Harness/>);fireEvent.click(screen.getByLabelText('Quero criar um endereço'));fireEvent.click(screen.getByLabelText('Sim, estou no meu endereço'));expect(location).not.toHaveBeenCalled();expect(screen.getByText('Confirmar Banda e continuar')).toBeDisabled();location.mockImplementation((_ok,fail)=>fail({code:1}));fireEvent.click(screen.getByText('Captar localização do meu endereço'));expect(screen.getByRole('alert')).toHaveTextContent('confirmar mais tarde');fireEvent.click(screen.getByLabelText('Fazer mais tarde'));expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();});
it('does not treat an existing address as a validated residence',()=>{render(<Harness/>);fireEvent.click(screen.getByLabelText('Já tenho um endereço AFROLOC'));expect(screen.getByText('Confirmar Banda e continuar')).toBeDisabled();fireEvent.change(screen.getByLabelText('Código AFROLOC existente'),{target:{value:'AO-LDA-TAL-G10-ABC-DEF'}});expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();expect(screen.getByText(/direito de utilização será verificado/)).toBeVisible();expect(location).not.toHaveBeenCalled();});

it('captures at home without claiming residency is already verified',()=>{
 render(<Harness/>);fireEvent.click(screen.getByLabelText('Quero criar um endereço'));fireEvent.click(screen.getByLabelText('Sim, estou no meu endereço'));
 location.mockImplementation(ok=>ok({coords:{latitude:-8.9,longitude:13.2,accuracy:20}}));
 fireEvent.click(screen.getByText('Captar localização do meu endereço'));
 expect(screen.getByRole('status')).toHaveTextContent('validação da residência fica pendente');
 expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();
});
it('ignores a GPS response after the user switches to deferred confirmation',()=>{
 let success: (p:unknown)=>void=()=>{};location.mockImplementation(ok=>{success=ok;});
 render(<Harness/>);fireEvent.click(screen.getByLabelText('Quero criar um endereço'));fireEvent.click(screen.getByLabelText('Sim, estou no meu endereço'));fireEvent.click(screen.getByText('Captar localização do meu endereço'));
 fireEvent.click(screen.getByLabelText('Fazer mais tarde'));success({coords:{latitude:1,longitude:2,accuracy:10}});
 expect(screen.queryByText(/Precisão indicada/)).not.toBeInTheDocument();expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();
});

it('allows a missing locality to be entered and saved without a mandatory catalog match',()=>{
 function Form(){
  const[country,setCountry]=useState('AO'); const[city,setCity]=useState('Luanda');const[n,setN]=useState('Talatona');const[custom,setCustom]=useState('');const[plan,setPlan]=useState<ResidencePlan>({method:'later'});
  return <ResidenceForm country={country} city={city} neighborhood={n} customNeighborhood={custom} onCountry={setCountry} onCity={setCity} onNeighborhood={setN} onCustomNeighborhood={setCustom} plan={plan} onPlan={setPlan} onContinue={done}/>;
 }
 render(<Form/>);
 fireEvent.change(screen.getByLabelText('País'),{target:{value:'PT'}});
 expect(screen.getByLabelText('Cidade')).toHaveValue('');
 expect(screen.getByLabelText('Bairro')).toHaveValue('');
 fireEvent.change(screen.getByLabelText('Cidade'),{target:{value:'Localidade não catalogada'}});
 fireEvent.change(screen.getByLabelText('Bairro'),{target:{value:'__other__'}});
 fireEvent.change(screen.getByLabelText('Nome do teu bairro'),{target:{value:'Bairro novo'}});
 fireEvent.click(screen.getByText('Confirmar Banda e continuar'));
 expect(done).toHaveBeenCalledOnce(); expect(location).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Cidade'),{target:{value:'  '}});
 expect(screen.getByText('Confirmar Banda e continuar')).toBeDisabled();
});

it('shows one address decision and keeps the import inside the selected choice',()=>{
 render(<Harness/>);
 expect(screen.queryByText('Carregar o meu cartão ou endereço AFROLOC')).not.toBeInTheDocument();
 expect(screen.queryByText('Sim, estou no meu endereço')).not.toBeInTheDocument();
 const option=screen.getByLabelText('Já tenho um endereço AFROLOC');fireEvent.click(option);
 expect(option.closest('div')).toContainElement(screen.getByLabelText('Código AFROLOC existente'));
 expect(screen.getByRole('button',{name:'Confirmar Banda e continuar'})).toBeDisabled();
 expect(screen.getByRole('status')).toHaveTextContent('Introduz um código AFROLOC válido');
 fireEvent.click(screen.getByLabelText('Fazer mais tarde'));
 expect(screen.queryByLabelText('Código AFROLOC existente')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Confirmar Banda e continuar'})).toBeEnabled();
});
it('clears dependent administrative selections when the province changes',()=>{
 render(<Harness/>);
 fireEvent.change(screen.getByLabelText('Província'),{target:{value:'AO-BGO'}});
 expect(screen.getByLabelText('Município')).toHaveValue('');expect(screen.getByLabelText('Comuna')).toBeDisabled();
 expect(screen.getByText('Confirmar Banda e continuar')).toBeDisabled();
 expect(screen.getByLabelText('Bairro / povoação / localidade')).toHaveValue('Talatona');
});
it('recovers a card hierarchy and does not invent a neighborhood',()=>{
 render(<Harness/>);fireEvent.click(screen.getByLabelText('Já tenho um endereço AFROLOC'));
 fireEvent.change(screen.getByLabelText('Código AFROLOC existente'),{target:{value:'AO-LDA-TAL-KBE-DIG-G10-ABC-DEF'}});
 expect(screen.getByLabelText('Comuna')).toHaveValue('AO-LDA-KBENFICA');
 expect(screen.getByLabelText('Bairro / povoação / localidade')).toHaveValue('Talatona');
});
it('fills an empty locality on card import and preserves the address complement',()=>{
 function Form(){const[city,setCity]=useState('');const[plan,setPlan]=useState<ResidencePlan>({method:'existing',administrative:{province:'AO-LDA',municipality:'AO-LDA-TALATONA',commune:'AO-LDA-KTALATONA',complement:'Casa 12'}});return <ResidenceForm country="AO" city={city} neighborhood="Bairro teste" customNeighborhood="" onCountry={()=>{}} onCity={setCity} onNeighborhood={()=>{}} onCustomNeighborhood={()=>{}} plan={plan} onPlan={setPlan} onContinue={done}/>;}
 render(<Form/>);
 fireEvent.change(screen.getByLabelText('Código AFROLOC existente'),{target:{value:'AO-LDA-TAL-KBE-DIG-G10-ABC-DEF'}});
 expect(screen.getByLabelText('Cidade / localidade (informação complementar)')).toHaveValue('Talatona');
 expect(screen.getByLabelText('Complemento do endereço (opcional)')).toHaveValue('Casa 12');
 expect(screen.getByText('Confirmar Banda e continuar')).toBeEnabled();
});

it('requires a selected and explicitly confirmed home point remotely, without GPS',async()=>{
 render(<Harness/>);fireEvent.click(screen.getByLabelText('Quero criar um endereço'));
 fireEvent.click(screen.getByRole('button',{name:'Escolher a minha casa no mapa'}));
 const save=screen.getByRole('button',{name:'Criar endereço e cartão'});
 expect(save).toBeDisabled();
 fireEvent.click(await screen.findByText('Marcar casa de teste'));
 expect(save).toBeDisabled();
 fireEvent.click(screen.getByLabelText('Confirmo que o ponto marcado corresponde à minha residência. A validação fica pendente.'));
 expect(save).toBeEnabled();fireEvent.click(save);expect(done).toHaveBeenCalledOnce();expect(location).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Marcar casa de teste'));expect(save).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Província'),{target:{value:'AO-BGO'}});expect(save).toBeDisabled();
});
