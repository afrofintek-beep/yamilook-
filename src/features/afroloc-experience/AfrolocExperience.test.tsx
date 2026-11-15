import {cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'test'},profile:{country_code:'AO'}})}));
vi.mock('@/i18n/ui-copy',()=>({useUiLocale:()=> 'pt',uiText:(value:string)=>value}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:vi.fn()}}}));
import AfrolocExperience from './AfrolocExperience';
afterEach(cleanup);
it('carries the interface language and avoids a duplicate address-back control',()=>{
 render(<MemoryRouter><AfrolocExperience/></MemoryRouter>);
 const frame=screen.getByTitle('O meu endereço AFROLOC');
 expect(frame.getAttribute('src')).toBe('https://app.afroloc.ao/experiencia/yamilook/?lang=pt');
 expect(screen.queryByRole('button',{name:'Voltar aos endereços'})).toBeNull();
 expect(screen.getByRole('link',{name:/Voltar à Yamilook/})).toBeVisible();
});
