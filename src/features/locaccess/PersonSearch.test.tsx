import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('./api',()=>({locaccess:api.call,validHandle:()=>true,accessLink:()=>''}));
vi.mock('./Farewell',()=>({Farewell:()=>null}));
import {AccessControl} from './AccessControl';
const person={id:'11111111-1111-4111-8111-111111111111',username:'ataide',display_name:'António Ataíde'};
const change=vi.fn();
const show=()=>{render(<AccessControl control={{policy:{handle:'test',grants:[]},url:'',busy:false,error:'',change,retry:vi.fn()} as never}/>)};
const search=async(query='@ataide')=>{fireEvent.change(screen.getByRole('searchbox'),{target:{value:query}});await act(async()=>vi.advanceTimersByTimeAsync(251))};
beforeEach(()=>{vi.useFakeTimers();api.call.mockReset();change.mockReset().mockResolvedValue(undefined)});
afterEach(()=>{cleanup();vi.useRealTimers()});
it('requires explicit selection and binds permission to the selected account',async()=>{
 api.call.mockResolvedValue([person]);show();const grant=screen.getByRole('button',{name:'Autorizar pessoa seleccionada'});expect(grant).toBeDisabled();await search();expect(api.call).toHaveBeenCalledWith('search',{query:'ataide'});expect(grant).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:/^António Ataíde/}));expect(change).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:/^António Ataíde/})).toHaveAttribute('aria-pressed','true');expect(grant).toBeEnabled();await act(async()=>fireEvent.click(grant));expect(change).toHaveBeenCalledWith('grant',{username:'ataide',recipient_id:person.id,radius:500,hours:24,offline_continuation:false});expect(grant).toBeDisabled();
});
it('keeps selections across searches and allows removal before granting',async()=>{
 api.call.mockResolvedValue([person]);show();await search();fireEvent.click(screen.getByRole('button',{name:/^António Ataíde/}));
 await search('outra');expect(screen.getByRole('button',{name:'Autorizar pessoa seleccionada'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Retirar António Ataíde da selecção'}));expect(screen.getByRole('button',{name:'Autorizar pessoa seleccionada'})).toBeDisabled();expect(change).not.toHaveBeenCalled();
});
it('reports no results and retries connection errors',async()=>{
 api.call.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);show();await search();expect(screen.getByText(/Não foi possível pesquisar/)).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));await act(async()=>vi.advanceTimersByTimeAsync(251));expect(screen.getByText(/Nenhuma pessoa encontrada/)).toBeVisible();expect(change).not.toHaveBeenCalled();
});
it('ignores late results from a previous query',async()=>{
 let resolve!:(p:typeof person[])=>void;api.call.mockImplementationOnce(()=>new Promise(r=>{resolve=r})).mockResolvedValue([]);show();await search();await search('outro');await act(async()=>resolve([person]));expect(screen.queryByRole('button',{name:/^António Ataíde/})).toBeNull();expect(screen.getByText(/Nenhuma pessoa encontrada/)).toBeVisible();
});

const other={id:'22222222-2222-4222-8222-222222222222',username:'@ana',display_name:'Ana'};
async function selectBoth(){
 api.call.mockResolvedValueOnce([person]).mockResolvedValueOnce([other]);show();await search();fireEvent.click(screen.getByRole('button',{name:/^António Ataíde/}));
 await search('ana');fireEvent.click(screen.getByRole('button',{name:/^Ana *@ana/}));
}
it('grants several recipients with chosen settings only after confirmation',async()=>{
 await selectBoth();expect(change).not.toHaveBeenCalled();expect(screen.queryByText('@@ana')).toBeNull();
 fireEvent.change(screen.getAllByRole('combobox')[0],{target:{value:'250'}});fireEvent.change(screen.getAllByRole('combobox')[1],{target:{value:'168'}});
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Autorizar pessoas seleccionadas (2)'})));
 expect(change.mock.calls).toEqual([['grant',{username:'ataide',recipient_id:person.id,radius:250,hours:168,offline_continuation:false}],['grant',{username:'@ana',recipient_id:other.id,radius:250,hours:168,offline_continuation:false}]]);
 expect(screen.getByText('Acessos autorizados: 2.')).toBeVisible();expect(screen.queryByRole('button',{name:/Retirar/})).toBeNull();
});
it('retains unfinished recipients after failure and retries without repeating successes',async()=>{
 await selectBoth();change.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Autorizar pessoas seleccionadas (2)'})));
 expect(screen.getByRole('alert')).toHaveTextContent('Acessos autorizados: 1. Não foi possível concluir.');
 expect(screen.queryByRole('button',{name:'Retirar António Ataíde da selecção'})).toBeNull();expect(screen.getByRole('button',{name:'Retirar Ana da selecção'})).toBeVisible();
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Autorizar pessoa seleccionada'})));
 expect(change).toHaveBeenCalledTimes(3);expect(change.mock.calls[2][1].recipient_id).toBe(other.id);
});
it('prevents duplicate submissions while pending',async()=>{
 await selectBoth();let done!:()=>void;change.mockImplementationOnce(()=>new Promise<void>(resolve=>{done=resolve}));
 const form=screen.getByRole('form',{name:'Escolher quem pode aceder'});fireEvent.submit(form);fireEvent.submit(form);expect(change).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('searchbox')).toBeDisabled();expect(screen.getAllByRole('combobox')[0]).toBeDisabled();
 expect(screen.getByRole('checkbox',{name:'Permitir continuidade breve sem rede na NJILA'})).toBeDisabled();
 await act(async()=>done());expect(change).toHaveBeenCalledTimes(2);
});
it('only grants offline continuity after an explicit owner choice and resets the next grant to false',async()=>{
 api.call.mockResolvedValue([person]);show();
 const consent=screen.getByRole('checkbox',{name:'Permitir continuidade breve sem rede na NJILA'});
 expect(consent).not.toBeChecked();
 fireEvent.click(consent);expect(change).not.toHaveBeenCalled();
 await search();fireEvent.click(screen.getByRole('button',{name:/^António Ataíde/}));
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Autorizar pessoa seleccionada'})));
 expect(change).toHaveBeenLastCalledWith('grant',expect.objectContaining({recipient_id:person.id,offline_continuation:true}));
 expect(consent).not.toBeChecked();
});
it('does not carry an offline choice into another address',()=>{
 const control={source:{id:'residence',code:'AO-TEST'},policy:{handle:'first',grants:[]},url:'',busy:false,error:'',change,retry:vi.fn()};
 const {rerender}=render(<AccessControl control={control as never}/>);
 const consent=screen.getByRole('checkbox',{name:'Permitir continuidade breve sem rede na NJILA'});
 fireEvent.click(consent);expect(consent).toBeChecked();
 rerender(<AccessControl control={{...control,source:{id:'residence',code:'AO-SECOND'},policy:{handle:'second',grants:[]}} as never}/>);
 expect(consent).not.toBeChecked();expect(change).not.toHaveBeenCalled();
});
it('stops new authorizations after leaving the screen',async()=>{
 await selectBoth();let done!:()=>void;change.mockImplementationOnce(()=>new Promise<void>(resolve=>{done=resolve}));
 fireEvent.click(screen.getByRole('button',{name:'Autorizar pessoas seleccionadas (2)'}));cleanup();await act(async()=>done());expect(change).toHaveBeenCalledTimes(1);
});
