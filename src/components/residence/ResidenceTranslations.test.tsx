import {act,cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import keys from '@/i18n/residence-keys.json';
import {useState} from 'react';
import {changeAppLanguage} from '@/i18n';
import {appLanguages} from '@/i18n/afroloc-languages';
import {uiText} from '@/i18n/ui-copy';
import {cardImportText} from '@/lib/afroloc-card-copy';
import {ResidenceForm} from './ResidenceForm';
import type {ResidencePlan} from '@/lib/residence';
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
afterEach(async()=>{cleanup();await changeAppLanguage('pt');});
it('switches every signup question and card message without losing the entered address',async()=>{
 function Form(){const[plan,onPlan]=useState<ResidencePlan>({method:'existing',code:'AO-LDA-TAL-KTA-DIG-G10-ABC-DEF'});return <ResidenceForm country="AO" city="Luanda" neighborhood="Talatona" customNeighborhood="" onCountry={()=>{}} onCity={()=>{}} onNeighborhood={()=>{}} onCustomNeighborhood={()=>{}} plan={plan} onPlan={onPlan} onContinue={()=>{}}/>}
 render(<Form/>);
 for(const {code} of appLanguages){
  await act(async()=>{await changeAppLanguage(code)});
  expect(screen.getByText(uiText('Qual é a tua Banda de residência?'))).toBeVisible();
  expect(screen.getByText(uiText('Já tens um endereço AFROLOC?'))).toBeVisible();
  expect(screen.getByRole('button',{name:uiText('Escolher imagem do cartão')})).toBeVisible();
  expect(screen.getByLabelText(uiText('Código AFROLOC existente'))).toHaveAttribute('dir','ltr');
  expect(screen.getByLabelText(uiText('Código AFROLOC existente'))).toHaveValue('AO-LDA-TAL-KTA-DIG-G10-ABC-DEF');
  if(code!=='pt')expect(cardImportText('A imagem deve ter até 10 MB.')).not.toBe('A imagem deve ter até 10 MB.');
 }
 fireEvent.click(screen.getByLabelText(uiText('Quero criar um endereço')));
 expect(screen.getByText(uiText('Estás neste momento na tua residência?'))).toBeVisible();
});

it('covers all residence copy in every enabled language',()=>{
 for(const {code} of appLanguages){
  const dictionary=JSON.parse(readFileSync(`src/i18n/residence/${code}.json`,'utf8'));
  for(const key of keys){expect(dictionary[key],`${code}: ${key}`).toBeTruthy();if(code!=='pt')expect(dictionary[key]).not.toBe(key);}
 }
});
