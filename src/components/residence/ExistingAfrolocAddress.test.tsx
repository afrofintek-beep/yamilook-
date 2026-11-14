import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ExistingAfrolocAddress } from './ExistingAfrolocAddress';
import { readAfrolocCard } from '@/lib/afroloc-card-import';
vi.mock('@/lib/afroloc-card-import', async original => ({...await original<typeof import('@/lib/afroloc-card-import')>(), readAfrolocCard:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('fills the editable address from a card without submitting residence', async()=>{
 vi.mocked(readAfrolocCard).mockResolvedValue('AO-ZU-G10-ABC-DEF');const change=vi.fn();
 render(<ExistingAfrolocAddress code="" onChange={change}/>);
 fireEvent.change(screen.getByLabelText('Carregar imagem do cartão AFROLOC'),{target:{files:[new File(['image'],'card.png',{type:'image/png'})]}});
 await waitFor(()=>expect(change).toHaveBeenCalledWith('AO-ZU-G10-ABC-DEF'));
 expect(screen.getByRole('status')).toHaveTextContent('Confirma o endereço');
});
it('keeps manual input if an older image read completes later',async()=>{
 let resolve!:(value:string)=>void;vi.mocked(readAfrolocCard).mockReturnValue(new Promise(r=>{resolve=r}));const change=vi.fn();
 render(<ExistingAfrolocAddress code="" onChange={change}/>);
 fireEvent.change(screen.getByLabelText('Carregar imagem do cartão AFROLOC'),{target:{files:[new File(['image'],'card.png',{type:'image/png'})]}});
 fireEvent.change(screen.getByLabelText('Código AFROLOC existente'),{target:{value:'AO-ZU-G10-MANUAL-CODE'}});
 resolve('AO-ZU-G10-OLD-CODE');await waitFor(()=>expect(change).toHaveBeenCalledTimes(1));
 expect(change).toHaveBeenCalledWith('AO-ZU-G10-MANUAL-CODE');
});
