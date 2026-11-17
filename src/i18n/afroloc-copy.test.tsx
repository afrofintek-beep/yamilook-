import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {changeAppLanguage} from './index';
import {uiText} from './ui-copy';
import {AccessControl} from '@/features/locaccess/AccessControl';
import {accessLink} from '@/features/locaccess/api';
import {readCardReference} from '@/shared/afroloc-card/protocol';
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:vi.fn().mockResolvedValue({data:[],error:null})}}));
const languages=['pt','en','fr','ar','am','sw','ln','yo','sn','zu'];
const dictionaries=import.meta.glob('./afroloc/*.json',{eager:true,import:'default'}) as Record<string,Record<string,string>>;
const variables=(s:string)=>[...s.matchAll(/\{\{(\w+)\}\}/g)].map(m=>m[1]).sort();
afterEach(async()=>{cleanup();await changeAppLanguage('pt')});
it('covers all address copy in ten languages without losing variables or brand names',async()=>{
 const base=dictionaries['./afroloc/pt.json'];
 for(const language of languages){
  const copy=dictionaries[`./afroloc/${language}.json`];expect(Object.keys(copy)).toEqual(Object.keys(base));
  for(const [source,value]of Object.entries(copy)){
   expect(value.trim(),source).not.toBe('');expect(variables(value),source).toEqual(variables(source));
   for(const brand of ['AFROLOC','Yamilook','NJILA','LOCACCESS'])if(source.includes(brand))expect(value,source).toContain(brand);
  }
  await changeAppLanguage(language);
  for(const [source,value]of Object.entries(copy))if(!variables(source).length)expect(uiText(source),source).toBe(value);
 }
});
it('keeps the query, access settings and recipient identity when switching language',async()=>{
 const change=vi.fn().mockResolvedValue(undefined);
 const control={policy:{handle:'00000000-0000-4000-8000-000000000001',enabled:true,grants:[{id:'g1',username:'ana_test',radius:250 as const,expiresAt:'2099-01-01T12:00:00Z'}]},url:'',busy:false,error:'',change,retry:vi.fn()};
 const view=render(<AccessControl control={control}/>);
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'@'}});
 fireEvent.change(screen.getAllByRole('combobox')[0],{target:{value:'100'}});
 fireEvent.change(screen.getAllByRole('combobox')[1],{target:{value:'168'}});
 for(const language of languages){
  await act(()=>changeAppLanguage(language));
  expect(screen.getByRole('searchbox')).toHaveValue('@');
  expect(screen.getAllByRole('combobox')[0]).toHaveValue('100');expect(screen.getAllByRole('combobox')[1]).toHaveValue('168');
  expect(screen.getByText('@ana_test')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:uiText('Autorizar pessoa seleccionada')})).toBeDisabled();
  expect(view.container.textContent).not.toContain('GPS');
  expect(view.container.textContent).not.toContain('{{');
  expect(document.documentElement.dir).toBe(language==='ar'?'rtl':'ltr');
  const url=accessLink(control.policy.handle);expect(new URL(url).searchParams.get('lang')).toBe(language);
  expect(readCardReference(url)).toEqual({kind:'access',url});
 }
 expect(change).not.toHaveBeenCalled();
});
