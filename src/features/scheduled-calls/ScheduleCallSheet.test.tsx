import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({save:vi.fn(),toast:vi.fn()}));
vi.mock('@/hooks/useContacts',()=>({useContacts:()=>({contacts:[]})}));
vi.mock('./useScheduledCalls',()=>({useScheduledCalls:()=>({save:state.save})}));
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:state.toast})}));
import {ScheduleCallSheet} from '@/components/calls/ScheduleCallSheet';
afterEach(cleanup);
beforeEach(()=>{state.save.mockReset();state.toast.mockReset();});
it('renders Portuguese labels and a close control',()=>{render(<ScheduleCallSheet open onOpenChange={()=>{}}/>);expect(screen.getByText('Repetição')).toBeTruthy();expect(screen.getByText('Fechar')).toBeTruthy();expect(screen.getByLabelText('Hora')).toHaveAttribute('type','time');});
it('does not submit an empty title',async()=>{render(<ScheduleCallSheet open onOpenChange={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Agendar chamada'}));expect(state.save).not.toHaveBeenCalled();expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({title:'Título obrigatório'}));});
it('keeps the form open and displays a failed save',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-25T01:00:00'));
 const close=vi.fn();state.save.mockRejectedValue(new Error('Não foi possível guardar'));
 render(<ScheduleCallSheet open onOpenChange={close}/>);fireEvent.change(screen.getByLabelText('Título *'),{target:{value:'Meeting'}});
 fireEvent.click(screen.getByRole('button',{name:'Agendar chamada'}));
 await waitFor(()=>expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({variant:'destructive',description:'Não foi possível guardar'})));
 expect(close).not.toHaveBeenCalled();expect(screen.getByLabelText('Título *')).toHaveValue('Meeting');vi.useRealTimers();
});
it('closes only after an acknowledged save and submits the device timezone',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-25T01:00:00'));const close=vi.fn();state.save.mockResolvedValue({id:'saved'});
 render(<ScheduleCallSheet open onOpenChange={close}/>);fireEvent.change(screen.getByLabelText('Título *'),{target:{value:'Meeting'}});fireEvent.click(screen.getByRole('button',{name:'Agendar chamada'}));
 await waitFor(()=>expect(close).toHaveBeenCalledWith(false));expect(state.save).toHaveBeenCalledWith(expect.objectContaining({timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,occurrences:1,request_id:expect.any(String)}),undefined);vi.useRealTimers();
});
