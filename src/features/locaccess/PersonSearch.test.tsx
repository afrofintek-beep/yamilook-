import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('./api',()=>({locaccess:api.call,validHandle:()=>true,accessLink:()=>''}));
import {AccessControl} from './AccessControl';
const person={id:'11111111-1111-4111-8111-111111111111',username:'ataide',display_name:'António Ataíde'};
const change=vi.fn();
const show=()=>{render(<AccessControl control={{policy:{handle:'test',grants:[]},url:'',busy:false,error:'',change,retry:vi.fn()} as never}/>)};
const search=async(query='@ataide')=>{fireEvent.change(screen.getByRole('searchbox'),{target:{value:query}});await act(async()=>vi.advanceTimersByTimeAsync(251))};
beforeEach(()=>{vi.useFakeTimers();api.call.mockReset();change.mockReset().mockResolvedValue(undefined)});
afterEach(()=>{cleanup();vi.useRealTimers()});
it('requires explicit selection and binds permission to the selected account',async()=>{
 api.call.mockResolvedValue([person]);show();const grant=screen.getByRole('button',{name:'Autorizar pessoa seleccionada'});expect(grant).toBeDisabled();await search();expect(api.call).toHaveBeenCalledWith('search',{query:'ataide'});expect(grant).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:/António Ataíde/}));expect(change).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:/António Ataíde/})).toHaveAttribute('aria-pressed','true');expect(grant).toBeEnabled();await act(async()=>fireEvent.click(grant));expect(change).toHaveBeenCalledWith('grant',{username:'ataide',recipient_id:person.id,radius:500,hours:24});expect(grant).toBeDisabled();
});
it('editing the selected name clears permission readiness',async()=>{
 api.call.mockResolvedValue([person]);show();await search();fireEvent.click(screen.getByRole('button',{name:/António Ataíde/}));fireEvent.change(screen.getByRole('searchbox'),{target:{value:'ana'}});expect(screen.getByRole('button',{name:'Autorizar pessoa seleccionada'})).toBeDisabled();expect(change).not.toHaveBeenCalled();
});
it('reports no results and retries connection errors',async()=>{
 api.call.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);show();await search();expect(screen.getByText(/Não foi possível pesquisar/)).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));await act(async()=>vi.advanceTimersByTimeAsync(251));expect(screen.getByText(/Nenhuma pessoa encontrada/)).toBeVisible();expect(change).not.toHaveBeenCalled();
});
it('ignores late results from a previous query',async()=>{
 let resolve!:(p:typeof person[])=>void;api.call.mockImplementationOnce(()=>new Promise(r=>{resolve=r})).mockResolvedValue([]);show();await search();await search('outro');await act(async()=>resolve([person]));expect(screen.queryByRole('button',{name:/António Ataíde/})).toBeNull();expect(screen.getByText(/Nenhuma pessoa encontrada/)).toBeVisible();
});
